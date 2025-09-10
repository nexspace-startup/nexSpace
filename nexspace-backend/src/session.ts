// src/session.ts
import { randomBytes } from "node:crypto";
import type { Response as ExpressResponse } from "express";
import { ensureRedisReady, getRedisClientOrThrow } from "./middleware/redis.js";

const SESSION_PREFIX = "sess:";
const USER_INDEX_PREFIX = "user_sess:"; // index by DB userId (when known)

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

  createdAt: string;      // ISO
  lastSeenAt: string;     // ISO
};

const k = {
  sess: (sid: string) => `${SESSION_PREFIX}${sid}`,
  userIdx: (userId: string) => `${USER_INDEX_PREFIX}${userId}`,
};

function newSid(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function cookieOpts(
  ttlSeconds = DEFAULT_TTL,
  isProd = process.env.NODE_ENV === "production"
) {
  console.log(process.env.NODE_ENV === "production")
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "none" as const,
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
  // Must match cookie attributes used when setting it (path/sameSite/secure)
  res.clearCookie(SID_COOKIE, { path: "/", sameSite: "none", httpOnly: true, secure: process.env.NODE_ENV === "production" });
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
  },
  ttlSeconds = DEFAULT_TTL
): Promise<SessionData> {
  const ready = await ensureRedisReady();
  if (!ready) throw new Error("Redis not available");
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
    createdAt: now,
    lastSeenAt: now,
  };

  const pipe = client.multi();
  pipe.set(k.sess(sid), JSON.stringify(data), { EX: ttlSeconds });

  // If we already know DB userId (e.g., local sign-in), index it now.
  if (user.userId) {
    pipe.sAdd(k.userIdx(user.userId), sid);
    pipe.expire(k.userIdx(user.userId), ttlSeconds);
  }
  await pipe.exec();

  return data;
}

/** Fast check: does a session key exist? */
export async function isSessionValid(sid: string | undefined): Promise<boolean> {
  if (!sid) return false;
  const ready = await ensureRedisReady();
  if (!ready) return false;
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
  console.log(ready, "ready");
  if (!ready) return null;
  const client = getRedisClientOrThrow();
  console.log(client, "client");

  const raw = await client.get(k.sess(sid));
  console.log(raw, "raw");
  if (!raw) return null;

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

  const pipe = client.multi();
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
  if (!ready) return null;
  const client = getRedisClientOrThrow();

  const raw = await client.get(k.sess(oldSid));
  if (!raw) return null;

  const prev = JSON.parse(raw) as SessionData;
  const sid = newSid();
  const nowIso = new Date().toISOString();

  const next: SessionData = {
    ...prev,
    sid,
    lastSeenAt: nowIso,
  };

  const pipe = client.multi();
  // 1) write new session (with new TTL)
  pipe.set(k.sess(sid), JSON.stringify(next), { EX: ttlSeconds });
  // 2) delete old session
  pipe.del(k.sess(oldSid));
  // 3) update user index (if we know DB userId)
  if (prev.userId) {
    pipe.sRem(k.userIdx(prev.userId), oldSid);
    pipe.sAdd(k.userIdx(prev.userId), sid);
    pipe.expire(k.userIdx(prev.userId), ttlSeconds);
  }
  await pipe.exec();

  return next;
}

/** Revoke a single session by sid (idempotent). */
export async function revokeSession(sid: string): Promise<void> {
  const ready = await ensureRedisReady();
  if (!ready) return;
  const client = getRedisClientOrThrow();

  const raw = await client.get(k.sess(sid));
  const pipe = client.multi();
  pipe.del(k.sess(sid));
  if (raw) {
    const data = JSON.parse(raw) as SessionData;
    if (data.userId) pipe.sRem(k.userIdx(data.userId), sid);
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
