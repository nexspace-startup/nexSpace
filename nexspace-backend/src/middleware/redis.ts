// src/middleware/redis.ts
import {
  createClient,
  type RedisClientType,
  type SetOptions,
} from "redis";

let client: RedisClientType | null = null;
let initPromise: Promise<RedisClientType | null> | null = null;

// Optional key prefix for namespacing (useful per-env: dev/stage/prod)
const PREFIX = process.env.REDIS_PREFIX ?? "";

// Simple circuit breaker to avoid hammering Redis when it's down
const BREAKER_THRESHOLD = Number(process.env.REDIS_BREAKER_THRESHOLD || 3); // consecutive failures
const BREAKER_COOLDOWN_MS = Number(process.env.REDIS_BREAKER_COOLDOWN_MS || 30_000); // 30s
let consecutiveFailures = 0;
let breakerOpenUntil = 0; // epoch ms when we can try again

function isBreakerOpen() {
  return Date.now() < breakerOpenUntil;
}

function recordFailure() {
  consecutiveFailures += 1;
  if (consecutiveFailures >= BREAKER_THRESHOLD) {
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS;
    consecutiveFailures = 0; // reset counter while open
    console.warn(`[redis] circuit breaker OPEN for ${BREAKER_COOLDOWN_MS}ms`);
  }
}

function recordSuccess() {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

/** Internal: build a single client instance with safe reconnect strategy. */
function buildClient(url: string): RedisClientType {
  const c = createClient({
    url,
    socket: {
      // exponential backoff with sane caps
      reconnectStrategy: (retries) => Math.min(1000 * 2 ** retries, 30_000),
      keepAlive: true,
    },
  });

  c.on("error", (e) => {
    console.error("[redis] client error:", e);
  });

  c.on("reconnecting", () => {
    console.warn("[redis] reconnecting…");
  });

  c.on("ready", () => {
    console.log("[redis] ready");
  });

  c.on("end", () => {
    console.warn("[redis] connection ended");
  });

  return c as RedisClientType;
}

/** Initialize (or reuse) a singleton Redis client. Safe to call multiple times. */
export async function initializeRedisClient(): Promise<RedisClientType | null> {
  if (client && client.isOpen) return client;
  if (initPromise) return initPromise;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[redis] REDIS_URL is not set; Redis features will be disabled.");
    return null;
  }

  if (isBreakerOpen()) {
    // quick fail during cooldown window
    return null;
  }

  initPromise = (async () => {
    const c = buildClient(url);
    try {
      await c.connect();
    } catch (e) {
      console.error("[redis] connect failed:", e);
      recordFailure();
      initPromise = null;
      return null;
    }

    // Fast health check + fail early if URL/ACL is wrong.
    try {
      await c.ping();
      client = c;
      recordSuccess();
      return client;
    } catch (e) {
      console.error("[redis] ping failed during init:", e);
      try {
        await c.quit();
      } catch {}
      client = null;
      recordFailure();
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/** Is Redis available and ready right now? */
export function isRedisWorking(): boolean {
  return Boolean(client && client.isOpen);
}

/** Get the current client or throw (use when Redis is *required* for path). */
export function getRedisClientOrThrow(): RedisClientType {
  if (!client || !client.isOpen) {
    throw new Error(
      "Redis client is not initialized/ready. Call initializeRedisClient() and await it before use."
    );
  }
  return client;
}

/** Apply namespace prefix (if configured). */
function k(key: string): string {
  return PREFIX ? `${PREFIX}:${key}` : key;
}

/** Write raw data (string/Buffer) with optional Redis SetOptions (EX, PX, NX, etc.). */
export async function writeData(
  key: string,
  data: string | Buffer,
  options?: SetOptions
): Promise<void> {
  if (!isRedisWorking()) return;
  try {
    const c = getRedisClientOrThrow();
    await c.set(k(key), data, options);
  } catch (e) {
    console.error(`[redis] failed to set key=${key}`, e);
  }
}

/** Write JSON with optional TTL/options. */
export async function writeJson<T>(
  key: string,
  value: T,
  options?: SetOptions
): Promise<void> {
  await writeData(key, JSON.stringify(value), options);
}

/** Read raw data; returns null if not found or Redis is unavailable. */
export async function readData(key: string): Promise<string | null> {
  if (!isRedisWorking()) return null;
  try {
    const c = getRedisClientOrThrow();
    return await c.get(k(key));
  } catch (e) {
    console.error(`[redis] failed to read key=${key}`, e);
    return null;
  }
}

/** Read JSON and parse into type T. Returns null on miss or parse error. */
export async function readJson<T>(key: string): Promise<T | null> {
  const raw = await readData(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[redis] failed to parse JSON for key=${key}`, e);
    return null;
  }
}

export async function readJsonMany<T>(keys: string[]): Promise<(T | null)[]> {
  if (!keys.length) return [];
  if (!isRedisWorking()) return keys.map(() => null);
  try {
    const c = getRedisClientOrThrow();
    const namespacedKeys = keys.map((key) => k(key));
    const raw = await c.mGet(namespacedKeys);
    return raw.map((value, idx) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch (e) {
        console.error(`[redis] failed to parse JSON for key=${keys[idx]}`, e);
        return null;
      }
    });
  } catch (e) {
    console.error(`[redis] failed to mget keys=${keys.join(",")}`, e);
    return keys.map(() => null);
  }
}

export async function deleteKeys(keys: string | string[]): Promise<void> {
  const list = Array.isArray(keys) ? keys : [keys];
  const filtered = list.filter((key): key is string => typeof key === "string" && key.length > 0);
  if (!filtered.length) return;
  if (!isRedisWorking()) return;
  try {
    const c = getRedisClientOrThrow();
    await c.del(filtered.map((key) => k(key)));
  } catch (e) {
    console.error(`[redis] failed to delete keys=${filtered.join(",")}`, e);
  }
}

/** Graceful shutdown (call from your app's shutdown hook). */
export async function closeRedis(): Promise<void> {
  if (client && client.isOpen) {
    try {
      await client.quit();
    } catch (e) {
      console.error("[redis] error on quit:", e);
      try {
        await client.disconnect();
      } catch {}
    }
    client = null;
  }
}

/** Utility to ensure client is ready before routes use it (idempotent). */
export async function ensureRedisReady(): Promise<boolean> {
  if (isBreakerOpen()) return false;
  const c = await initializeRedisClient();
  return Boolean(c && c.isOpen);
}
