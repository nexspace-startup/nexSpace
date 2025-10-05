import { prisma, Prisma } from "../prisma.js";

export async function findWorkspaceByUid(uid: string) {
  return prisma.workspace.findUnique({ where: { uid }, select: { uid: true, name: true } });
}

export async function isWorkspaceMember(workspaceUid: string, userId: bigint) {
  return prisma.workspaceMember.findFirst({
    where: { workspaceUid, userId },
    select: { role: true },
  });
}

export async function findWorkspacesForUser(userId: bigint) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      role: true,
      workspace: {
        select: {
          uid: true,
          name: true,
        },
      },
    },
  });
}

export async function listWorkspaceMembers(workspaceUid: string, query?: string) {
  const normalizedQuery = query?.trim();
  const whereUser: Prisma.UserWhereInput | undefined = normalizedQuery
    ? {
        OR: [
          { displayName: { contains: normalizedQuery, mode: "insensitive" } },
          { email: { contains: normalizedQuery, mode: "insensitive" } },
        ],
      }
    : undefined;
  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceUid, ...(whereUser ? { user: whereUser } : {}) },
    select: {
      user: { select: { id: true, first_name: true, last_name: true, displayName: true, email: true } },
    },
  });
  return rows.map((r) => ({
    id: String(r.user.id),
    name:
      r.user.displayName?.trim() ||
      [r.user.first_name, r.user.last_name].filter(Boolean).join(" ") ||
      r.user.email,
  }));
}
