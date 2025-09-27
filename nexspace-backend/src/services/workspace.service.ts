import { findWorkspaceByUid, isWorkspaceMember, listWorkspaceMembers as repoListMembers } from "../repositories/workspace.repository.js";
import { prisma } from "../prisma.js";

export async function listMembers(workspaceUid: string, userId: string, q?: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  return repoListMembers(ws.uid, q);
}

export async function createWorkspaceForUser(userId: string, name: string) {
  // ensure unique name per user (simple heuristic)
  const exists = await prisma.workspace.findFirst({ where: { name, createdById: BigInt(userId) }, select: { uid: true } });
  if (exists) throw new Error("WORKSPACE_CONFLICT");
  const ws = await prisma.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: { name, createdById: BigInt(userId) },
      select: { uid: true, name: true },
    });
    await tx.workspaceMember.create({
      data: { workspaceUid: created.uid, userId: BigInt(userId), role: "OWNER" as any },
    });
    return created;
  });
  return { id: ws.uid, name: ws.name };
}

export async function deleteWorkspaceForUser(userId: string, workspaceUid: string) {
  const ws = await prisma.workspace.findUnique({ where: { uid: workspaceUid }, select: { uid: true, createdById: true } });
  if (!ws) throw new Error("NOT_FOUND");
  if (String(ws.createdById) !== String(userId)) throw new Error("FORBIDDEN");
  await prisma.workspace.delete({ where: { uid: workspaceUid } });
}
