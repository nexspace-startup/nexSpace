import { prisma } from "../prisma.js";

export async function createChatMessage(workspaceUid: string, senderId: bigint, roomUid: string, content: string) {
  return prisma.chatMessage.create({
    data: { workspaceUid, senderId, roomUid, content },
    select: { id: true, workspaceUid: true, senderId: true, roomUid: true, content: true, createdAt: true, deletedAt: true },
  });
}

export async function listChatMessages(workspaceUid: string, limit = 50, before?: Date) {
  return prisma.chatMessage.findMany({
    where: {
      workspaceUid,
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

export async function softDeleteMessage(id: bigint, workspaceUid: string, byUserId: bigint, allowAny = false) {
  const where: any = { id, workspaceUid };
  if (!allowAny) where.senderId = byUserId;
  return prisma.chatMessage.updateMany({
    where,
    data: { deletedAt: new Date(), content: "" },
  });
}

export async function softDeleteAllByUserInWorkspace(userId: bigint, workspaceUid: string) {
  return prisma.chatMessage.updateMany({
    where: { senderId: userId, workspaceUid },
    data: { deletedAt: new Date(), content: "" },
  });
}

export async function purgeOlderThan(workspaceUid: string, olderThan: Date) {
  return prisma.chatMessage.deleteMany({
    where: { workspaceUid, createdAt: { lt: olderThan } },
  });
}

