import { prisma } from "../prisma.js";

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
  return prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    select: { uid: true, name: true },
  });
}
