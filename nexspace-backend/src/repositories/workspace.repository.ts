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
  return await prisma.workspaceMember.findMany({
    where: { userId: userId },
    select: {
      role: true,
      workspace: {
        select: {
          uid: true,
          name: true
        }
      }
    }
  });
}
