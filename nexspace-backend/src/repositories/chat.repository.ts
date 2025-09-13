import { prisma } from "../prisma.js";

export async function createChatMessage(workspaceId: bigint, senderId: bigint, roomUid: string, content: string) {
  return prisma.chatMessage.create({
    data: { workspaceId, senderId, roomUid, content },
    select: { id: true, workspaceId: true, senderId: true, roomUid: true, content: true, createdAt: true, deletedAt: true },
  });
}

export async function listChatMessages(workspaceId: bigint, limit = 50, before?: Date) {
  return prisma.chatMessage.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 200)),
    select: {
      id: true,
      senderId: true,
      roomUid: true,
      content: true,
      createdAt: true,
      sender: { select: { id: true, first_name: true, last_name: true, displayName: true, email: true } },
    },
  });
}

export async function softDeleteMessage(id: bigint, workspaceId: bigint, byUserId: bigint, allowAny = false) {
  // If allowAny=false, restrict to own messages only
  const where: any = { id, workspaceId };
  if (!allowAny) where.senderId = byUserId;
  return prisma.chatMessage.updateMany({
    where,
    data: { deletedAt: new Date(), content: "" },
  });
}

export async function softDeleteAllByUserInWorkspace(userId: bigint, workspaceId: bigint) {
  return prisma.chatMessage.updateMany({
    where: { senderId: userId, workspaceId },
    data: { deletedAt: new Date(), content: "" },
  });
}

export async function purgeOlderThan(workspaceId: bigint, olderThan: Date) {
  return prisma.chatMessage.deleteMany({
    where: { workspaceId, createdAt: { lt: olderThan } },
  });
}

