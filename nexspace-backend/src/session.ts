import cookie from 'cookie';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

export interface SessionData {
  userId?: string;
  sub?: string;
  email?: string;
  wids?: string[];
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, duration: number): Promise<void>;
  del(key: string): Promise<void>;
}

// We only import ioredis if REDIS_URL is defined
let redis: RedisLike | null = null;
if (process.env.REDIS_URL) {
  try {
    const Redis = (await import('ioredis')).default as unknown as {
      new (url: string): RedisLike;
    };
    redis = new Redis(process.env.REDIS_URL);
    console.log('[session] Using Redis at', process.env.REDIS_URL);
  } catch (err) {
    console.warn(
      '[session] Failed to init Redis, falling back to memory store:',
      err,
    );
  }
}

// fallback: in-memory store
const memoryStore = new Map<string, SessionData>();

async function getFromStore(sid: string): Promise<SessionData | null> {
  if (redis) {
    const raw = await redis.get(`sess:${sid}`);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  }
  return memoryStore.get(sid) ?? null;
}

async function setInStore(
  sid: string,
  data: SessionData,
  ttl: number,
): Promise<void> {
  if (redis) {
    await redis.set(`sess:${sid}`, JSON.stringify(data), 'EX', ttl);
  } else {
    memoryStore.set(sid, data);
    // expire manually after ttl
    setTimeout(() => memoryStore.delete(sid), ttl * 1000).unref();
  }
}

async function delFromStore(sid: string): Promise<void> {
  if (redis) {
    await redis.del(`sess:${sid}`);
  } else {
    memoryStore.delete(sid);
  }
}

export async function getSession(
  req: Request,
): Promise<{ data: SessionData | null; sid: string | null }> {
  const sid = cookie.parse(req.headers.cookie || '').sid;
  if (!sid) return { data: null, sid: null };
  const data = await getFromStore(sid);
  return { data, sid };
}

export async function setSession(
  res: Response,
  data: SessionData,
  maxAge = 60 * 60 * 24 * 7,
): Promise<void> {
  const sid = randomBytes(24).toString('base64url');
  await setInStore(sid, data, maxAge);

  res.setHeader(
    'Set-Cookie',
    cookie.serialize('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    }),
  );
}

export async function clearSession(
  req: Request,
  res: Response,
): Promise<void> {
  const sid = cookie.parse(req.headers.cookie || '').sid;
  if (sid) await delFromStore(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly');
}
