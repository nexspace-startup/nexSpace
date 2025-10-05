import { AccessToken } from "livekit-server-sdk";
import { config } from "../config/env.js";
import { findWorkspaceByUid, isWorkspaceMember, findWorkspacesForUser } from "../repositories/workspace.repository.js";

type SessionContext = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatar?: string | null;
};

export async function buildMeetingJoinToken(userId: string, workspaceUid: string, sess: SessionContext) {
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
  if ((member as { status?: string | null } | null)?.status === "SUSPENDED") throw new Error("FORBIDDEN");

  const identity = String(userId);
  const displayName =
    [sess?.firstName, sess?.lastName].filter(Boolean).join(" ") ||
    sess?.email ||
    `user-${identity}`;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: displayName, ttl: "2h" });
  try {
    const avatar = sess?.avatar ?? undefined;
    const meta = JSON.stringify({ profile: { name: displayName, avatar } });
    (at as unknown as { metadata?: string }).metadata = meta;
    (at as unknown as { attributes?: Record<string, string> }).attributes = {
      presence_status: "IN_MEETING",
      presence_ts: Date.now().toString(),
    };
  } catch { /* ignore */ }
  at.addGrant({ room: ws.uid, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true });
  const token = await at.toJwt();
  return { url: LIVEKIT_URL, token, identity, room: ws.uid };
}

export async function listWorkspacesForUser(userId: string) {
  const rows = await findWorkspacesForUser(BigInt(userId));
  return rows.map((ws) => ({
    id: ws.workspace?.uid ?? "",
    name: ws.workspace?.name ?? "",
    role: ws.role,
  }));
}

