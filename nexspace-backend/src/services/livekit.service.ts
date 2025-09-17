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
  const kind = reliable ? DataPacket_Kind.RELIABLE : DataPacket_Kind.LOSSY;
  // Use positional signature which is supported across server-sdk versions
  // sendData(room, data, kind, destinationSids?, topic?)
  await (c as any).sendData(room, data, kind, undefined, topic);
}
