import { findWorkspaceByUid, isWorkspaceMember, listWorkspaceMembers as repoListMembers } from "../repositories/workspace.repository.js";
import { prisma, Prisma, WorkspaceRole } from "../prisma.js";
import { CacheKeys, CacheTTL, invalidateCache, setCache } from "../utils/cache.js";
import { getPresenceSnapshot } from "./presence.service.js";

export async function listMembers(workspaceUid: string, userId: string, q?: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  const members = await repoListMembers(ws.uid, q);
  const presenceMap = await getPresenceSnapshot(
    ws.uid,
    members.map((m) => m.id)
  );

  return members.map((m) => ({
    ...m,
    workspaceId: ws.uid,
    status: presenceMap[m.id]?.status ?? "AVAILABLE",
    lastSeenAt: presenceMap[m.id]?.ts ?? null,
  }));
}

export async function createWorkspaceForUser(userId: string, name: string) {
  // ensure unique name per user (simple heuristic)
  const exists = await prisma.workspace.findFirst({ where: { name, createdById: BigInt(userId) }, select: { uid: true } });
  if (exists) throw new Error("WORKSPACE_CONFLICT");
  const ws = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.workspace.create({
      data: { name, createdById: BigInt(userId) },
      select: { uid: true, name: true },
    });
    await tx.workspaceMember.create({
      data: { workspaceUid: created.uid, userId: BigInt(userId), role: WorkspaceRole.OWNER },
    });
    return created;
  });
  const userIdStr = String(userId);
  await Promise.all([
    setCache(CacheKeys.workspace(ws.uid), { uid: ws.uid, name: ws.name }, CacheTTL.workspace),
    setCache(CacheKeys.workspaceMember(ws.uid, userIdStr), { role: WorkspaceRole.OWNER }, CacheTTL.workspaceMember),
    invalidateCache(
      CacheKeys.userProfile(userIdStr),
      CacheKeys.userWorkspaces(userIdStr),
      CacheKeys.workspaceMembers(ws.uid)
    ),
  ]);
  return { id: ws.uid, name: ws.name };
}

export async function deleteWorkspaceForUser(userId: string, workspaceUid: string) {
  const ws = await prisma.workspace.findUnique({ where: { uid: workspaceUid }, select: { uid: true, createdById: true } });
  if (!ws) throw new Error("NOT_FOUND");
  if (String(ws.createdById) !== String(userId)) throw new Error("FORBIDDEN");
  const memberIds = await prisma.workspaceMember.findMany({
    where: { workspaceUid },
    select: { userId: true },
  });
  await prisma.workspace.delete({ where: { uid: workspaceUid } });
  const keys: string[] = [CacheKeys.workspace(workspaceUid), CacheKeys.workspaceMembers(workspaceUid)];
  const userKeys: string[] = [];
  for (const member of memberIds) {
    const idStr = member.userId.toString();
    userKeys.push(
      CacheKeys.workspaceMember(workspaceUid, idStr),
      CacheKeys.userProfile(idStr),
      CacheKeys.userWorkspaces(idStr)
    );
  }
  await invalidateCache(...keys, ...userKeys);
}

export async function updateWorkspaceForUser(userId: string, workspaceUid: string, name: string) {
  const ws = await prisma.workspace.findUnique({
    where: { uid: workspaceUid },
    select: { uid: true, createdById: true },
  });

  if (!ws) throw new Error("NOT_FOUND");
  if (String(ws.createdById) !== String(userId)) throw new Error("FORBIDDEN");

  const updated = await prisma.workspace.update({
    where: { uid: workspaceUid },
    data: { name },
    select: { uid: true, name: true },
  });

  const memberIds = await prisma.workspaceMember.findMany({
    where: { workspaceUid },
    select: { userId: true },
  });

  const invalidations: string[] = [CacheKeys.workspaceMembers(workspaceUid)];
  for (const member of memberIds) {
    const idStr = member.userId.toString();
    invalidations.push(CacheKeys.userProfile(idStr), CacheKeys.userWorkspaces(idStr));
  }

  await Promise.all([
    setCache(CacheKeys.workspace(updated.uid), { uid: updated.uid, name: updated.name }, CacheTTL.workspace),
    invalidateCache(...invalidations),
  ]);

  return { id: updated.uid, name: updated.name };
}

