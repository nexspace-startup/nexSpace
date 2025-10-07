import { prisma } from "../prisma.js";
import { CacheKeys, CacheTTL, getCached, setCache } from "../utils/cache.js";

export async function findAuthIdentity(provider: "google" | "microsoft", providerId: string) {
  const key = CacheKeys.authIdentity(provider, providerId);
  const cached = await getCached<{ userId: string }>(key);
  if (cached) {
    return { userId: BigInt(cached.userId) };
  }

  const row = await prisma.authIdentity.findUnique({
    where: { provider_providerId: { provider, providerId } },
    select: { userId: true },
  });

  if (!row) return null;

  await setCache(key, { userId: row.userId.toString() }, CacheTTL.authIdentity);
  return row;
}

