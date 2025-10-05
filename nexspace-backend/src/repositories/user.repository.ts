import { prisma, Prisma, type User } from "../prisma.js";

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

export async function getUserWithMemberships(userId: bigint) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          workspace: { include: { _count: { select: { members: true } } } },
        },
      },
    },
  });
}

export type UserSearchResult = Pick<User, "id" | "email" | "displayName">;

export async function seachByUsernameEmail(ch: string): Promise<UserSearchResult[]> {
  const query = ch.trim();
  if (!query) {
    return [];
  }

  const where: Prisma.UserWhereInput = {
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


