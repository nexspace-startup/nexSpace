import { AccessToken } from "livekit-server-sdk";
import { config } from "../config/env.js";
import { findWorkspaceById, isWorkspaceMember, findWorkspacesForUser } from "../repositories/workspace.repository.js";

export async function buildMeetingJoinToken(userId: string, workspaceUid: string, sess: any) {
  const LIVEKIT_URL = config.liveKit.url;
  const LIVEKIT_API_KEY = config.liveKit.apiKey;
  const LIVEKIT_API_SECRET = config.liveKit.apiSecret;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    throw new Error("LIVEKIT_MISCONFIGURED");
  }

  const wsId = BigInt(workspaceUid);
  const ws = await findWorkspaceById(wsId);
  if (!ws) throw new Error("WORKSPACE_NOT_FOUND");

  const member = await isWorkspaceMember(ws.id, BigInt(userId));
  if (!member) throw new Error("FORBIDDEN");
  if ((member as any)?.status === "SUSPENDED") throw new Error("FORBIDDEN");

  const identity = String(userId);
  const displayName = [sess?.firstName, sess?.lastName].filter(Boolean).join(" ") || (sess as any)?.email || `user-${identity}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: displayName, ttl: "2h" });
  at.addGrant({ room: ws.uid, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true });
  const token = await at.toJwt();
  return { url: LIVEKIT_URL, token, identity, room: ws.uid };
}

export async function listWorkspacesForUser(userId: string) {
  const rows = await findWorkspacesForUser(BigInt(userId));
  return rows.map((ws) => ({ id: String(ws.id), name: ws.name }));
}

