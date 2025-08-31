import cookie from 'cookie';
import { randomBytes } from 'node:crypto';

// We only import ioredis if REDIS_URL is defined
let redis = null;
if (process.env.REDIS_URL) {
  try {
    const Redis = (await import('ioredis')).default;
    redis = new Redis(process.env.REDIS_URL);
    console.log('[session] Using Redis at', process.env.REDIS_URL);
  } catch (err) {
    console.warn('[session] Failed to init Redis, falling back to memory store:', err);
  }
}

// fallback: in-memory store
const memoryStore = new Map();

async function getFromStore(sid) {
  if (redis) {
    const raw = await redis.get(`sess:${sid}`);
    return raw ? JSON.parse(raw) : null;
  } else {
    return memoryStore.get(sid) ?? null;
  }
}

async function setInStore(sid, data, ttl) {
  if (redis) {
    await redis.set(`sess:${sid}`, JSON.stringify(data), 'EX', ttl);
  } else {
    memoryStore.set(sid, data);
    // expire manually after ttl
    setTimeout(() => memoryStore.delete(sid), ttl * 1000).unref();
  }
}

async function delFromStore(sid) {
  if (redis) {
    await redis.del(`sess:${sid}`);
  } else {
    memoryStore.delete(sid);
  }
}

export async function getSession(req) {
  const sid = cookie.parse(req.headers.cookie || '').sid;
  if (!sid) return { data: null, sid: null };
  const data = await getFromStore(sid);
  return { data, sid };
}

export async function setSession(res, data, maxAge = 60 * 60 * 24 * 7) {
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

export async function clearSession(req, res) {
  const sid = cookie.parse(req.headers.cookie || '').sid;
  if (sid) await delFromStore(sid);
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0; HttpOnly');
}
