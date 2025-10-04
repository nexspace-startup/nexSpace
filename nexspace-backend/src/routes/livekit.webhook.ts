import express from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { config } from '../config/env.js';
import { upsertPresenceOnJoin, clearPresenceOnLeave } from '../services/presence.service.js';

const router = express.Router();

// This route MUST receive the raw body for signature verification
// Accept both application/webhook+json (LiveKit) and application/json to be future-proof
router.use(express.raw({ type: (req) => true, limit: '1mb' }));

// Quick health endpoint to validate external reachability (no auth)
router.get('/ping', (_req, res) => res.status(200).send('ok'));

// Single POST endpoint for LiveKit events
router.post('/', async (req, res) => {
  try {
    const apiKey = process.env.LIVEKIT_WEBHOOK_API_KEY || config.liveKit.apiKey;
    const apiSecret = process.env.LIVEKIT_WEBHOOK_API_SECRET || config.liveKit.apiSecret;
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
    const authHeader =
      req.get('Authorization') ||
      req.get('authorization') ||
      (req.headers as any)['Authorize'] ||
      (req.headers as any)['authorize'];

    const skipVerify = String(process.env.LIVEKIT_WEBHOOK_SKIP_VERIFY || '').toLowerCase() === 'true';
    const evt = await receiver.receive(raw, authHeader as any, skipVerify);

    // Ack early to avoid retries; handle async
    res.status(204).end();

    const roomUid = evt.room?.name || evt.room?.sid || undefined;
    const identity = evt.participant?.identity || undefined;
    const participantSid = evt.participant?.sid || undefined;
    if (!roomUid || !identity) return;

    switch (evt.event) {
      case 'participant_joined':
        await upsertPresenceOnJoin({ roomUid, identity, participantSid });
        break;
      case 'participant_left':
      case 'participant_connection_aborted':
        await clearPresenceOnLeave({ roomUid, identity, participantSid });
        break;
      default:
        break;
    }
  } catch (e: any) {
    // signature/parse failures
    console.warn('[livekit-webhook] invalid or failed verification:', e?.message);
    try { res.status(401).json({ error: 'invalid webhook' }); } catch { }
  }
});

export default router;
