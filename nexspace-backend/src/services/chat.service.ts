import { findWorkspaceByUid, isWorkspaceMember } from "../repositories/workspace.repository.js";
import { createChatMessage, listChatMessages as repoList, softDeleteAllByUserInWorkspace, softDeleteMessage, purgeOlderThan } from "../repositories/chat.repository.js";
import { config } from "../config/env.js";
import { maybeDecrypt, maybeEncrypt } from "../utils/chatCrypto.js";

export type ChatDTO = {
  id: string;
  text: string;
  ts: string; // ISO
  sender: { id: string; name: string };
};

function toName(u: { first_name: string; last_name: string; displayName: string | null; email: string }) {
  return (u.displayName && u.displayName.trim()) || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
}

export async function postMessage(workspaceUid: string, userId: string, text: string): Promise<ChatDTO> {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(BigInt(ws.id), BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");

  // retention: opportunistic purge on write
  const days = Math.max(0, Number(config.chat.retentionDays || 0));
  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    // best-effort purge
    try { await purgeOlderThan(BigInt(ws.id), cutoff); } catch {}
  }

  const stored = await createChatMessage(BigInt(ws.id), BigInt(userId), ws.uid, maybeEncrypt(text));
  return {
    id: String(stored.id),
    text,
    ts: stored.createdAt.toISOString(),
    sender: { id: String(userId), name: "" }, // name filled by client or list endpoint
  };
}

export async function listChatMessages(workspaceUid: string, userId: string, limit = 50, before?: Date): Promise<ChatDTO[]> {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(BigInt(ws.id), BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");

  const rows = await repoList(BigInt(ws.id), limit, before);
  return rows
    .map((r) => ({
      id: String(r.id),
      text: maybeDecrypt(r.content),
      ts: r.createdAt.toISOString(),
      sender: { id: String(r.senderId), name: toName(r.sender as any) },
    }))
    .reverse(); // chronological ascending
}

export async function deleteMyMessage(workspaceUid: string, userId: string, messageId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(BigInt(ws.id), BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  const res = await softDeleteMessage(BigInt(messageId), BigInt(ws.id), BigInt(userId), false);
  return res.count; // 0 or 1
}

export async function adminDeleteAnyMessage(workspaceUid: string, userId: string, messageId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(BigInt(ws.id), BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  if (!['OWNER','ADMIN'].includes(String((membership as any).role))) throw new Error("FORBIDDEN");
  const res = await softDeleteMessage(BigInt(messageId), BigInt(ws.id), BigInt(userId), true);
  return res.count;
}

export async function eraseMyDataInWorkspace(workspaceUid: string, userId: string) {
  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");
  const membership = await isWorkspaceMember(BigInt(ws.id), BigInt(userId));
  if (!membership) throw new Error("FORBIDDEN");
  const res = await softDeleteAllByUserInWorkspace(BigInt(userId), BigInt(ws.id));
  return res.count;
}

