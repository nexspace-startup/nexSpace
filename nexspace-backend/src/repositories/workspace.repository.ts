import { prisma } from "../prisma.js";

export async function findWorkspaceById(id: bigint) {
  return prisma.workspace.findUnique({ where: { id }, select: { id: true, uid: true, name: true } });
}

export async function isWorkspaceMember(workspaceId: bigint, userId: bigint) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
}

export async function findWorkspacesForUser(userId: bigint) {
  return prisma.workspace.findMany({
    where: { members: { some: { userId } } },
    select: { id: true, name: true },
  });
}

