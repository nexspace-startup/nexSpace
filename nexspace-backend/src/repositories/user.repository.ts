import { prisma, type User } from "../prisma.js";
import { CacheKeys, CacheTTL, getCached, setCache } from "../utils/cache.js";

export async function findUserByEmail(emailLc: string) {
  return prisma.user.findUnique({
    where: { email: emailLc },
    select: { id: true, email: true, first_name: true, last_name: true },
  });
}

export async function getUserLoginByUserId(userId: bigint) {
  return prisma.userLogin.findUnique({ where: { userId } });
}

export async function updateUserLoginHash(userId: bigint, newHash: string) {
  await prisma.userLogin.update({
    where: { userId },
    data: { hash: newHash, alg: "argon2id" },
  });
}

export async function upsertLocalAuthIdentity(userId: bigint, emailLc: string) {
  await prisma.authIdentity.upsert({
    where: { provider_providerId: { provider: "local", providerId: `local:${emailLc}` } },
    update: { lastLoginAt: new Date() },
    create: { userId, provider: "local", providerId: `local:${emailLc}`, lastLoginAt: new Date() },
  });
}

type WorkspaceMembershipRow = {
  role: string;
  workspace: {
    id: string | bigint;
    uid: string;
    name: string;
    _count: { members: number };
  };
};

type PrismaUserWithMemberships = {
  id: string | bigint;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  memberships: WorkspaceMembershipRow[];
};

type CachedMembership = {
  role: string;
  workspace: { id: string; uid: string; name: string; memberCount: number };
};

type CachedUserProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  memberships: CachedMembership[];
};

export type UserWithMembershipsResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  memberships: Array<{
    role: string;
    workspace: { id: string; uid: string; name: string; _count: { members: number } };
  }>;
};

function hydrateUser(payload: CachedUserProfile): UserWithMembershipsResult {
  return {
    id: payload.id,
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    memberships: payload.memberships.map((m) => ({
      role: m.role,
      workspace: {
        id: m.workspace.id,
        uid: m.workspace.uid,
        name: m.workspace.name,
        _count: { members: m.workspace.memberCount },
      },
    })),
  };
}

function serializeUser(row: PrismaUserWithMemberships): CachedUserProfile {
  return {
    id: row.id.toString(),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    memberships: row.memberships.map((m) => ({
      role: m.role,
      workspace: {
        id: m.workspace.id.toString(),
        uid: m.workspace.uid,
        name: m.workspace.name,
        memberCount: m.workspace._count.members,
      },
    })),
  };
}

export async function getUserWithMemberships(userId: bigint): Promise<UserWithMembershipsResult | null> {
  const key = CacheKeys.userProfile(userId);
  const cached = await getCached<CachedUserProfile>(key);

  if (cached) {
    return hydrateUser(cached);
  }

  const row = (await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          workspace: { include: { _count: { select: { members: true } } } },
        },
      },
    },
  })) as PrismaUserWithMemberships | null;

  if (!row) return null;

  const payload = serializeUser(row);
  await setCache(key, payload, CacheTTL.userProfile);

  return hydrateUser(payload);
}

export type UserSearchResult = Pick<User, "id" | "email" | "displayName">;

export async function seachByUsernameEmail(ch: string): Promise<UserSearchResult[]> {
  const query = ch.trim();
  if (!query) {
    return [];
  }

  const where: any = {
    OR: [
      { email: { contains: query, mode: "insensitive" } },
      { displayName: { contains: query, mode: "insensitive" } },
    ],
  };

  return prisma.user.findMany({
    where,
    select: { id: true, email: true, displayName: true },
  });
}
