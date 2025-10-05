// src/session.ts
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import type { Response as ExpressResponse } from "express";
import { ensureRedisReady, getRedisClientOrThrow } from "./middleware/redis.js";

const SESSION_PREFIX = "sess:";
const USER_INDEX_PREFIX = "user_sess:"; // index by DB userId (when known)
const SUB_INDEX_PREFIX = "sub_sess:";  // index by OAuth sub (when known)

export const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days (seconds)
export const SID_COOKIE = "sid";

export type Provider = "google" | "microsoft" | "local" | string;

export type SessionData = {
  sid: string;

  // Identity hints (OAuth-first or local):
  sub?: string;           // OAuth subject (Google/MS)
  userId?: string;        // DB user id (attached later by /auth/me or present for local sign-in)
  email?: string;
  firstName?: string;
  lastName?: string;
  provider?: Provider;
  avatar?: string; // optional URL for user avatar (e.g., Google picture)

  createdAt: string;      // ISO
  lastSeenAt: string;     // ISO
};

const k = {
  sess: (sid: string) => `${SESSION_PREFIX}${sid}`,
  userIdx: (userId: string) => `${USER_INDEX_PREFIX}${userId}`,
  subIdx: (sub: string) => `${SUB_INDEX_PREFIX}${sub}`,
};

function newSid(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

// Stateless session fallback (signed token) when Redis is unavailable.
// Token format: base64url(json).base64url(hmacSha256(json)) using SESSION_SECRET
function getSecret(): string {
  const s = process.env.SESSION_SECRET || "dev-secret";
  return String(s);
}

function b64urlEncode(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str: string) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function signPayload(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload));
  const mac = createHmac('sha256', getSecret()).update(body).digest();
  return `${b64urlEncode(body)}.${b64urlEncode(mac)}`;
}

function verifyToken(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const body = b64urlDecode(parts[0]);
    const sig = b64urlDecode(parts[1]);
    const calc = createHmac('sha256', getSecret()).update(body).digest();
    if (sig.length !== calc.length || !timingSafeEqual(sig, calc)) return null;
    const payload = JSON.parse(body.toString('utf8')) as any;
    if (typeof payload !== 'object' || !payload) return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

function toSessionDataFromPayload(p: any): SessionData {
  const nowIso = new Date().toISOString();
  return {
    sid: signPayload(p),
    sub: p.sub,
    userId: p.userId,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    provider: p.provider,
    avatar: p.avatar,
    createdAt: new Date((p.iat || Math.floor(Date.now()/1000)) * 1000).toISOString(),
    lastSeenAt: nowIso,
  };
}

function buildPayloadFromUser(user: any, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: user.sub,
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    provider: user.provider,
    avatar: (user as any).avatar,
    iat: now,
    exp: now + Math.max(1, ttlSeconds),
  };
}

function cookieOpts(
  ttlSeconds = DEFAULT_TTL,
  // Only treat true production as "prod" for cookie attributes. In development we
  // must allow non-HTTPS + SameSite=Lax so iOS/Safari and mobile devices accept cookies.
  isProd = process.env.NODE_ENV === "production"
) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" as const : "lax" as const,
    path: "/",
    maxAge: Math.max(ttlSeconds, 0) * 1000, // ms
  };
}

/** Set the HTTP-only session cookie. Pass ttlSeconds if you want a persistent cookie (remember-me). */
export function setSessionCookie(
  res: ExpressResponse,
  sid: string,
  ttlSeconds = DEFAULT_TTL
) {
  res.cookie(SID_COOKIE, sid, cookieOpts(ttlSeconds));
}

/** Clear the session cookie. */
export function clearSessionCookie(res: ExpressResponse) {
  const isProd = process.env.NODE_ENV === "production";
  // Must match cookie attributes used when setting it (path/sameSite/secure)
  res.clearCookie(SID_COOKIE, { path: "/", sameSite: isProd ? "none" as const : "lax" as const, httpOnly: true, secure: isProd });
}

/**
 * Create a session. Works for both OAuth-first (sub known, userId not yet)
 * and local sign-in (userId known).
 */
export async function createSession(
  user: {
    userId?: string;
    sub?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    provider?: Provider;
    avatar?: string;
  },
  ttlSeconds = DEFAULT_TTL
): Promise<SessionData> {
  const ready = await ensureRedisReady();
  if (!ready) {
    // fallback: stateless signed cookie
    const payload = buildPayloadFromUser(user, ttlSeconds);
    return toSessionDataFromPayload(payload);
  }
  const client = getRedisClientOrThrow();

  if (!user.userId && !user.sub) {
    throw new Error("createSession requires either userId or sub");
  }

  const sid = newSid();
  const now = new Date().toISOString();

  const data: SessionData = {
    sid,
    sub: user.sub,
    userId: user.userId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    provider: user.provider,
    avatar: user.avatar,
    createdAt: now,
    lastSeenAt: now,
  };

  const pipe = client.multi();

  // If a session already exists for this userId or sub, revoke older ones first
  try {
    const toDelete = new Set<string>();
    if (user.userId) {
      const sids = await client.sMembers(k.userIdx(user.userId));
      for (const s of sids) toDelete.add(s);
    }
    if (user.sub) {
      const sids = await client.sMembers(k.subIdx(user.sub));
      for (const s of sids) toDelete.add(s);
    }
    if (toDelete.size > 0) {
      for (const s of toDelete) {
        pipe.del(k.sess(s));
        if (user.userId) pipe.sRem(k.userIdx(user.userId), s);
        if (user.sub) pipe.sRem(k.subIdx(user.sub), s);
      }
    }
  } catch {/* ignore */ }
  pipe.set(k.sess(sid), JSON.stringify(data), { EX: ttlSeconds });

  // If we already know DB userId (e.g., local sign-in), index it now.
  if (user.userId) {
    pipe.sAdd(k.userIdx(user.userId), sid);
    pipe.expire(k.userIdx(user.userId), ttlSeconds);
  }
  if (user.sub) {
    pipe.sAdd(k.subIdx(user.sub), sid);
    pipe.expire(k.subIdx(user.sub), ttlSeconds);
  }
  await pipe.exec();

  return data;
}

/** Fast check: does a session key exist? */
export async function isSessionValid(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  const ready = await ensureRedisReady();
  if (!ready) {
    const p = verifyToken(sid);
    return !!p;
  }
  const client = getRedisClientOrThrow();
  const exists = await client.exists(k.sess(sid));
  return exists === 1;
}

/**
 * Read session by sid. If slidingTtlSeconds is provided, refresh TTL and lastSeenAt.
 * Only updates Redis when sliding TTL is requested.
 */
export async function getSession(
  sid: string,
  slidingTtlSeconds?: number
): Promise<SessionData | null> {
  const ready = await ensureRedisReady();
  if (ready) {
    const client = getRedisClientOrThrow();
    const raw = await client.get(k.sess(sid));
    if (raw) {
      const data = JSON.parse(raw) as SessionData;
      if (slidingTtlSeconds && slidingTtlSeconds > 0) {
        data.lastSeenAt = new Date().toISOString();
        const pipe = client.multi();
        pipe.set(k.sess(sid), JSON.stringify(data), { EX: slidingTtlSeconds });
        if (data.userId) pipe.expire(k.userIdx(data.userId), slidingTtlSeconds);
        await pipe.exec();
      }
      return data;
    }
    // Not found in Redis; try fallback token (e.g., issued while Redis was down)
    const p = verifyToken(sid);
    return p ? toSessionDataFromPayload(p) : null;
  }
  // Redis not ready: verify fallback token
  const p = verifyToken(sid);
  return p ? toSessionDataFromPayload(p) : null;
}

/**
 * Attach the DB userId to an existing session (after onboarding or first /auth/me),
 * and index the session by userId so you can revoke all sessions for that user later.
 */
export async function attachDbUserIdToSession(
  sid: string,
  dbUserId: string,
  firstName?: string,
  lastName?: string,
  ttlSeconds = DEFAULT_TTL
): Promise<SessionData | null> {
  const ready = await ensureRedisReady();
  if (!ready) return null;
  const client = getRedisClientOrThrow();

  const raw = await client.get(k.sess(sid));
  if (!raw) return null;

  const data = JSON.parse(raw) as SessionData;
  data.userId = dbUserId;
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  data.lastSeenAt = new Date().toISOString();

  // Enforce single active session per user: remove all other sessions for this userId
  const pipe = client.multi();
  try {
    const existing = await client.sMembers(k.userIdx(dbUserId));
    for (const otherSid of existing) {
      if (otherSid === sid) continue;
      const otherRaw = await client.get(k.sess(otherSid));
      pipe.del(k.sess(otherSid));
      pipe.sRem(k.userIdx(dbUserId), otherSid);
      if (otherRaw) {
        try {
          const other = JSON.parse(otherRaw) as SessionData;
          if (other?.sub) pipe.sRem(k.subIdx(other.sub), otherSid);
        } catch { /* ignore parse errors */ }
      }
    }
  } catch { /* ignore */ }

  // Persist updated session and index
  pipe.set(k.sess(sid), JSON.stringify(data), { EX: ttlSeconds });
  pipe.sAdd(k.userIdx(dbUserId), sid);
  pipe.expire(k.userIdx(dbUserId), ttlSeconds);
  await pipe.exec();

  return data;
}

/**
 * Rotate an existing session into a brand-new SID.
 * Prevents session fixation and lets you change TTL (e.g., remember-me).
 * Returns the updated SessionData or null if oldSid not found.
 */
export async function rotateSession(
  oldSid: string,
  ttlSeconds = DEFAULT_TTL
): Promise<SessionData | null> {
  const ready = await ensureRedisReady();
  if (ready) {
    const client = getRedisClientOrThrow();
    const raw = await client.get(k.sess(oldSid));
    if (!raw) return null;
    const prev = JSON.parse(raw) as SessionData;
    const sid = newSid();
    const nowIso = new Date().toISOString();
    const next: SessionData = { ...prev, sid, lastSeenAt: nowIso };
    const pipe = client.multi();
    pipe.set(k.sess(sid), JSON.stringify(next), { EX: ttlSeconds });
    pipe.del(k.sess(oldSid));
    if (prev.userId) {
      pipe.sRem(k.userIdx(prev.userId), oldSid);
      pipe.sAdd(k.userIdx(prev.userId), sid);
      pipe.expire(k.userIdx(prev.userId), ttlSeconds);
    }
    if (prev.sub) {
      pipe.sRem(k.subIdx(prev.sub), oldSid);
      pipe.sAdd(k.subIdx(prev.sub), sid);
      pipe.expire(k.subIdx(prev.sub), ttlSeconds);
    }
    await pipe.exec();
    return next;
  }
  // Stateless fallback: reissue signed token with new exp
  const p = verifyToken(oldSid);
  if (!p) return null;
  const payload = buildPayloadFromUser(p, ttlSeconds);
  return toSessionDataFromPayload(payload);
}

/** Revoke a single session by sid (idempotent). */
export async function revokeSession(sid: string): Promise<void> {
  const ready = await ensureRedisReady();
  if (!ready) return; // stateless fallback cannot revoke server-side; client should clear cookie
  const client = getRedisClientOrThrow();

  const raw = await client.get(k.sess(sid));
  const pipe = client.multi();
  pipe.del(k.sess(sid));
  if (raw) {
    const data = JSON.parse(raw) as SessionData;
    if (data.userId) pipe.sRem(k.userIdx(data.userId), sid);
    if (data.sub) pipe.sRem(k.subIdx(data.sub), sid);
  }
  await pipe.exec();
}

/** Revoke all sessions for a DB user id. */
export async function revokeAllSessions(userId: string): Promise<void> {
  const ready = await ensureRedisReady();
  if (!ready) return;
  const client = getRedisClientOrThrow();

  const sids = await client.sMembers(k.userIdx(userId));
  const pipe = client.multi();
  for (const sid of sids) pipe.del(k.sess(sid));
  pipe.del(k.userIdx(userId));
  await pipe.exec();
}

/** Revoke all sessions for an OAuth sub. */
export async function revokeAllSessionsBySub(sub: string): Promise<void> {
  const ready = await ensureRedisReady();
  if (!ready) return;
  const client = getRedisClientOrThrow();
  const sids = await client.sMembers(k.subIdx(sub));
  const pipe = client.multi();
  for (const s of sids) pipe.del(k.sess(s));
  pipe.del(k.subIdx(sub));
  await pipe.exec();
}
