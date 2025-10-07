import { Prisma, prisma } from "../prisma.js";

export async function createChatMessage(
  workspaceUid: string,
  senderId: bigint,
  roomUid: string,
  content: string,
  recipientId?: bigint
) {
  return prisma.chatMessage.create({
    data: {
      workspaceUid,
      senderId,
      roomUid,
      content,
      ...(recipientId ? { recipientId } : {}),
    },
    select: {
      id: true,
      workspaceUid: true,
      senderId: true,
      recipientId: true,
      roomUid: true,
      content: true,
      createdAt: true,
      deletedAt: true,
    },
  });
}

export async function listChatMessages(
  workspaceUid: string,
  limit = 50,
  before?: Date,
  peerId?: bigint,
  meId?: bigint
) {
  const where: Prisma.ChatMessageWhereInput = {
    workspaceUid,
    deletedAt: null,
  };
  if (before) {
    where.createdAt = { lt: before };
  }
  if (peerId && meId) {
    // DM thread between two users
    where.OR = [
      { senderId: meId, recipientId: peerId },
      { senderId: peerId, recipientId: meId },
    ];
  } else {
    // group chat only
    where.recipientId = null;
  }
  return prisma.chatMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 200)),
    select: {
      id: true,
      senderId: true,
      recipientId: true,
      roomUid: true,
      content: true,
      createdAt: true,
      sender: { select: { id: true, first_name: true, last_name: true, displayName: true, email: true, avatar: true } },
    },
  });
}

export async function softDeleteMessage(id: bigint, workspaceUid: string, byUserId: bigint, allowAny = false) {
  const where: Prisma.ChatMessageWhereInput = { id, workspaceUid };
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

export async function listRecentPrivateMessagesForUser(
  workspaceUid: string,
  meId: bigint,
  take: number = 500
) {
  return prisma.chatMessage.findMany({
    where: {
      workspaceUid,
      deletedAt: null,
      recipientId: { not: null },
      OR: [{ senderId: meId }, { recipientId: meId }],
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(take, 1000)),
    select: { senderId: true, recipientId: true, content: true, createdAt: true },
  });
}

export async function getDMUnreadCounts(
  workspaceUid: string,
  meId: bigint
) {
  // 1) Get lastReadAt per peer
  const reads = await prisma.chatThreadRead.findMany({
    where: { workspaceUid, userId: meId },
    select: { peerId: true, lastReadAt: true },
  });

  const lastMap = new Map<string, Date>();
  for (const r of reads) {
    // make sure it's a Date
    lastMap.set(String(r.peerId), new Date(r.lastReadAt));
  }

  const trackedPeerIds = Array.from(lastMap.keys()).map((id) => BigInt(id));

  // 2) Base filter: all DMs addressed to me in this workspace
  const baseWhere: Prisma.ChatMessageWhereInput = {
    workspaceUid,
    recipientId: meId,
    deletedAt: null,
  };

  // 3) Build OR:
  // - For each tracked peer: messages after lastReadAt
  // - Plus: messages from any untracked peer (no read row yet) => all count as unread
  const orClauses: Prisma.ChatMessageWhereInput[] =
    trackedPeerIds.length === 0
      ? []
      : trackedPeerIds.map((pid) => {
        const last = lastMap.get(String(pid))!; // exists by construction
        return { senderId: pid, createdAt: { gt: last } };
      });

  if (trackedPeerIds.length > 0) {
    orClauses.push({ senderId: { notIn: trackedPeerIds } });
  }

  const where: Prisma.ChatMessageWhereInput =
    orClauses.length > 0 ? { AND: [baseWhere, { OR: orClauses }] } : baseWhere;

  // 4) Group counts per sender
  const rows = await prisma.chatMessage.groupBy({
    by: ["senderId"],
    where,
    _count: { _all: true },
  });

  // 5) Normalize to { [peerId]: count }, including zeros for tracked peers
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[String(r.senderId)] = Number(r._count?._all || 0);
  }
  for (const pid of trackedPeerIds) {
    const key = String(pid);
    if (!(key in counts)) counts[key] = 0;
  }

  return counts;
}

export async function markDMThreadRead(
  workspaceUid: string,
  meId: bigint,
  peerId: bigint,
  at?: Date
) {
  const when = at ?? new Date();
  await prisma.chatThreadRead.upsert({
    where: { workspaceUid_userId_peerId: { workspaceUid, userId: meId, peerId } },
    update: { lastReadAt: when },
    create: { workspaceUid, userId: meId, peerId, lastReadAt: when },
  });
}

