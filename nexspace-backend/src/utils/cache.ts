import { deleteKeys, readJson, writeJson } from "../middleware/redis.js";

export const CacheKeys = {
  workspace: (uid: string) => `workspace:${uid}`,
  workspaceMembers: (uid: string) => `workspace:${uid}:members`,
  workspaceMember: (uid: string, userId: string | number | bigint) =>
    `workspace:${uid}:member:${String(userId)}`,
  userProfile: (userId: string | number | bigint) => `user:${String(userId)}:profile`,
  userWorkspaces: (userId: string | number | bigint) => `user:${String(userId)}:workspaces`,
  authIdentity: (provider: string, providerId: string) => `auth:identity:${provider}:${providerId}`,
} as const;

export const CacheTTL = {
  workspace: 300,
  workspaceMembers: 180,
  workspaceMember: 180,
  userProfile: 300,
  userWorkspaces: 180,
  authIdentity: 600,
} as const;

export async function getCached<T>(key: string): Promise<T | null> {
  return readJson<T>(key);
}

export async function setCache<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  const options = ttlSeconds && ttlSeconds > 0 ? { EX: ttlSeconds } : undefined;
  await writeJson(key, value, options);
}

export async function withCache<T>(
  key: string,
  ttlSeconds: number | undefined,
  loader: () => Promise<T | null | undefined>
): Promise<T | null> {
  const cached = await getCached<T>(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  if (fresh !== undefined && fresh !== null) {
    await setCache(key, fresh, ttlSeconds);
    return fresh;
  }

  return fresh ?? null;
}

export async function invalidateCache(...keys: (string | null | undefined | false)[]): Promise<void> {
  const filtered = keys.filter((key): key is string => typeof key === "string" && key.length > 0);
  if (!filtered.length) return;
  await deleteKeys(filtered);
}

