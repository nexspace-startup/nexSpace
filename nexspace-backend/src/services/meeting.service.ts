import { AccessToken } from "livekit-server-sdk";
import { config } from "../config/env.js";
import { findWorkspaceByUid, isWorkspaceMember, findWorkspacesForUser } from "../repositories/workspace.repository.js";

export async function buildMeetingJoinToken(userId: string, workspaceUid: string, sess: any) {
  const LIVEKIT_URL = config.liveKit.url;
  const LIVEKIT_API_KEY = config.liveKit.apiKey;
  const LIVEKIT_API_SECRET = config.liveKit.apiSecret;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    throw new Error("LIVEKIT_MISCONFIGURED");
  }

  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

  const member = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!member) throw new Error("FORBIDDEN");
  if ((member as any)?.status === "SUSPENDED") throw new Error("FORBIDDEN");

  const identity = String(userId);
  const displayName = [sess?.firstName, sess?.lastName].filter(Boolean).join(" ") || (sess as any)?.email || `user-${identity}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: displayName, ttl: "2h" });
  try {
    const avatar = (sess as any)?.avatar as string | undefined;
    const presence = { status: 'IN_MEETING', ts: Date.now() };
    const meta = JSON.stringify({ profile: { name: displayName, avatar }, presence });
    (at as any).metadata = meta;
  } catch { /* ignore */ }
  at.addGrant({ room: ws.uid, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true });
  const token = await at.toJwt();
  return { url: LIVEKIT_URL, token, identity, room: ws.uid };
}

export async function listWorkspacesForUser(userId: string) {
  const rows = await findWorkspacesForUser(BigInt(userId));
  return rows.map((ws) => ({ id: ws.workspace?.uid, name: ws.workspace?.name, role: ws.role }));
}

