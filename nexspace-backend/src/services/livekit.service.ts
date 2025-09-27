import { RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';
import { config } from '../config/env.js';

let client: RoomServiceClient | null = null;

function getClient(): RoomServiceClient {
  if (!client) {
    const { url, apiKey, apiSecret } = config.liveKit;
    if (!url || !apiKey || !apiSecret) {
      throw new Error('LIVEKIT_MISCONFIGURED');
    }
    client = new RoomServiceClient(url, apiKey, apiSecret);
  }
  return client;
}

export async function sendDataToRoom(
  room: string,
  payload: any,
  topic = 'chat',
  reliable = true,
  destinationIdentities?: string[]
) {
  const c = getClient();
  const data = Buffer.from(JSON.stringify(payload));
  const kind = reliable ? DataPacket_Kind.RELIABLE : DataPacket_Kind.LOSSY;

  if (destinationIdentities && destinationIdentities.length > 0) {
    // Map identities -> participant SIDs
    try {
      const parts = await (c as any).listParticipants(room);
      const byIdentity = new Map<string, string>();
      for (const p of parts ?? []) {
        if (p?.identity && p?.sid) byIdentity.set(String(p.identity), String(p.sid));
      }
      const sids = destinationIdentities
        .map((id) => byIdentity.get(String(id)))
        .filter((sid): sid is string => !!sid);
      if (sids.length === 0) return;
      await (c as any).sendData(room, data, kind, sids, topic);
      return;
    } catch {
      // fall through to broadcast
      return;
    }
  }
  // Broadcast
  if (!destinationIdentities || destinationIdentities.length === 0)
    await (c as any).sendData(room, data, kind, undefined, topic);
}
