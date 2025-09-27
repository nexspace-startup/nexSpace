import { findWorkspaceByUid, isWorkspaceMember } from "../repositories/workspace.repository.js";
import { createChatMessage, listChatMessages as repoList, softDeleteAllByUserInWorkspace, softDeleteMessage, purgeOlderThan, listRecentPrivateMessagesForUser, getDMUnreadCounts, markDMThreadRead } from "../repositories/chat.repository.js";
import { config } from "../config/env.js";
import { maybeDecrypt, maybeEncrypt } from "../utils/chatCrypto.js";
import { sendDataToRoom } from "./livekit.service.js";
import { prisma } from "../prisma.js";

export type ChatDTO = {
  id: string;
  text: string;
  ts: string; // ISO
  sender: { id: string; name: string };
  recipientId?: string | null; // present for private messages
};

function toName(u: { first_name: string; last_name: string; displayName: string | null; email: string }) {
  return (u.displayName && u.displayName.trim()) || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
}

export async function postMessage(workspaceUid: string, userId: string, text: string, clientId?: string, recipientId?: string): Promise<ChatDTO> {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");

  // retention: opportunistic purge on write
  const days = Math.max(0, Number(config.chat.retentionDays || 0));
  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    // best-effort purge
    try { await purgeOlderThan(ws.uid, cutoff); } catch {}
  }

  const stored = await createChatMessage(
    ws.uid,
    BigInt(userId),
    ws.uid,
    maybeEncrypt(text),
    recipientId ? BigInt(recipientId) : undefined
  );

  // Broadcast to LiveKit; include client-provided id if available so clients can reconcile optimistic messages
  try {
    const payload = {
      type: 'chat',
      id: clientId || String(stored.id),
      text,
      senderSid: String(userId),
      senderName: '',
      recipientSid: recipientId ? String(recipientId) : undefined,
    } as any;
    const destIds = recipientId ? [String(userId), String(recipientId)] : undefined;
    await sendDataToRoom(ws.uid, payload, 'chat', true, destIds);
  } catch (e) {
    // Do not fail persistence if publish fails; log and continue
    console.error('[chat] LiveKit publish failed:', (e as any)?.message || e);
  }

  return {
    id: String(stored.id),
    text,
    ts: stored.createdAt.toISOString(),
    sender: { id: String(userId), name: "" }, // name filled by client or list endpoint
    recipientId: recipientId ? String(recipientId) : undefined,
  };
}

// Bulk posting removed; single-message posting only

export async function listChatMessages(workspaceUid: string, userId: string, limit = 50, before?: Date, peerId?: string): Promise<ChatDTO[]> {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");

  const rows = await repoList(ws.uid, limit, before, peerId ? BigInt(peerId) : undefined, BigInt(userId));
  return (rows as any)
    .map((r: any) => ({
      id: String(r.id),
      text: maybeDecrypt(r.content),
      ts: r.createdAt.toISOString(),
      sender: { id: String(r.senderId), name: toName(r.sender as any) },
      recipientId: r.recipientId ? String(r.recipientId) : undefined,
    }))
    .reverse(); // chronological ascending
}

export async function deleteMyMessage(workspaceUid: string, userId: string, messageId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  const res = await softDeleteMessage(BigInt(messageId), ws.uid, BigInt(userId), false);
  return res.count; // 0 or 1
}

export async function adminDeleteAnyMessage(workspaceUid: string, userId: string, messageId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  if (!['OWNER','ADMIN'].includes(String((membership as any).role))) throw new Error("FORBIDDEN");
  const res = await softDeleteMessage(BigInt(messageId), ws.uid, BigInt(userId), true);
  return res.count;
}

export async function eraseMyDataInWorkspace(workspaceUid: string, userId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  const res = await softDeleteAllByUserInWorkspace(BigInt(userId), ws.uid);
  return res.count;
}

export async function listDMThreads(workspaceUid: string, userId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");

  const rows = await listRecentPrivateMessagesForUser(ws.uid, BigInt(userId), 500);
  // reduce to latest per peer
  type Preview = { peerId: string; text?: string; ts?: string };
  const map = new Map<string, Preview>();
  for (const r of rows as any[]) {
    const sender = String(r.senderId);
    const recip = String(r.recipientId);
    const peer = sender === String(userId) ? recip : sender;
    if (!peer) continue;
    if (!map.has(peer)) {
      map.set(peer, { peerId: peer, text: maybeDecrypt(r.content), ts: r.createdAt.toISOString() });
    }
  }
  // compute unread counts
  const unread = await getDMUnreadCounts(ws.uid, BigInt(userId));
  const peerIds = Array.from(map.keys()).map((id) => BigInt(id));
  const users = await prisma.user.findMany({
    where: { id: { in: peerIds } },
    select: { id: true, first_name: true, last_name: true, displayName: true, email: true },
  });
  const nameMap = new Map<string, string>();
  for (const u of users) nameMap.set(String(u.id), toName(u as any));

  return Array.from(map.values()).map((p) => ({
    peer: { id: p.peerId, name: nameMap.get(p.peerId) || p.peerId },
    last: p.text ? { text: p.text, ts: p.ts! } : undefined,
    unread: unread[p.peerId] || 0,
  }));
}

export async function markThreadRead(workspaceUid: string, userId: string, peerId: string, at?: Date) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  await markDMThreadRead(ws.uid, BigInt(userId), BigInt(peerId), at);
}
