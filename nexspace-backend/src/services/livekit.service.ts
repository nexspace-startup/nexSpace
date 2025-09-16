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

export async function sendDataToRoom(room: string, payload: any, topic = 'chat', reliable = true) {
  const c = getClient();
  const data = Buffer.from(JSON.stringify(payload));
  // Use reliable channel for chat acks
  const kind = reliable ? DataPacket_Kind.RELIABLE : DataPacket_Kind.LOSSY;
  // SDK supports object params in recent versions; fallback to positional signature is also supported.
  try {
    // Prefer object form when available
    const req: any = { room, data, kind, topic };
    if (typeof (c as any).sendData === 'function') {
      await (c as any).sendData(req as any);
    } else {
      // very old SDK fallback
      await (c as any).sendData(room, data, kind, undefined, topic);
    }
  } catch (e) {
    throw e;
  }
}

