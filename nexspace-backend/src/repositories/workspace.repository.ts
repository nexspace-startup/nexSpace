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

export async function listWorkspaceMembers(workspaceUid: string, query?: string) {
  const whereUser: any = query && query.trim()
    ? {
      OR: [
        { displayName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    }
    : {};
  const rows = await prisma.workspaceMember.findMany({
    where: { workspaceUid, user: whereUser },
    select: {
      user: { select: { id: true, first_name: true, last_name: true, displayName: true, email: true } },
    },
  });
  return rows.map((r) => ({ id: String(r.user.id), name: (r.user.displayName && r.user.displayName.trim()) || [r.user.first_name, r.user.last_name].filter(Boolean).join(' ') || r.user.email }));
}
