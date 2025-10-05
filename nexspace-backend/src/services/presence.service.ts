import { prisma } from "../prisma.js";
import { writeJson } from "../middleware/redis.js";
import { RoomServiceClient } from "livekit-server-sdk";
import { config } from "../config/env.js";

export type PresenceStatusAPI = 'AVAILABLE' | 'BUSY' | 'IN_MEETING' | 'AWAY' | 'DO_NOT_DISTURB';

function presenceKey(roomUid: string, identity: string) {
  return `presence:room:${roomUid}:identity:${identity}`;
}

const PRESENCE_STATUS_ATTRIBUTE = 'presence_status';
const PRESENCE_TS_ATTRIBUTE = 'presence_ts';

export async function updateParticipantPresenceAttributes(roomUid: string, identity: string, status: PresenceStatusAPI) {
  try {
    const svc = new RoomServiceClient(config.liveKit.url, config.liveKit.apiKey, config.liveKit.apiSecret);
    await svc.updateParticipant(roomUid, identity, {
      attributes: {
        [PRESENCE_STATUS_ATTRIBUTE]: status,
        [PRESENCE_TS_ATTRIBUTE]: Date.now().toString(),
      },
    });
  } catch (e) {
    // Ignore if participant is not currently in the room
  }
}

export async function upsertPresenceOnJoin(args: { roomUid: string; identity: string; participantSid?: string }) {
  const { roomUid, identity, participantSid } = args;
  const userId = BigInt(identity);
  const now = new Date();
  try {
    await prisma.userPresence.upsert({
      where: { userId_workspaceUid: { userId, workspaceUid: roomUid } },
      update: { status: 'IN_MEETING', isOnline: true, lastActivity: now },
      create: { userId, workspaceUid: roomUid, status: 'IN_MEETING', isOnline: true, lastActivity: now },
    });
  } catch {}
  try {
    await writeJson(presenceKey(roomUid, identity), { status: 'in_meeting', ts: Date.now(), sid: participantSid });
  } catch {}
  await updateParticipantPresenceAttributes(roomUid, identity, 'IN_MEETING');
}

export async function clearPresenceOnLeave(args: { roomUid: string; identity: string; participantSid?: string }) {
  const { roomUid, identity } = args;
  const userId = BigInt(identity);
  const now = new Date();
  try {
    await prisma.userPresence.upsert({
      where: { userId_workspaceUid: { userId, workspaceUid: roomUid } },
      update: { isOnline: false, lastActivity: now },
      create: { userId, workspaceUid: roomUid, isOnline: false, status: 'AVAILABLE', lastActivity: now },
    });
  } catch {}
  try {
    await writeJson(presenceKey(roomUid, identity), { status: 'offline', ts: Date.now() });
  } catch {}
}

export async function setUserPresenceStatus(args: { roomUid: string; identity: string; status: PresenceStatusAPI }) {
  const { roomUid, identity, status } = args;
  console.log(status);
  const userId = BigInt(identity);
  const now = new Date();

  // Update DB
  try {
    await prisma.userPresence.upsert({
      where: { userId_workspaceUid: { userId, workspaceUid: roomUid } },
      update: { status, lastActivity: now },
      create: { userId, workspaceUid: roomUid, status, isOnline: true, lastActivity: now },
    });
  } catch {}

  // Update Redis cache
  try {
    await writeJson(presenceKey(roomUid, identity), { status: status.toLowerCase(), ts: Date.now() });
  } catch {}

  // Update LiveKit metadata (best-effort)
  await updateParticipantPresenceAttributes(roomUid, identity, status);
}

