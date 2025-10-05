import type { Request, Response } from 'express';
import { z } from 'zod';
import { setUserPresenceStatus } from '../services/presence.service.js';
import { findWorkspaceByUid, isWorkspaceMember } from '../repositories/workspace.repository.js';

const bodySchema = z.object({
  status: z.enum(['AVAILABLE', 'BUSY', 'IN_MEETING', 'AWAY', 'DO_NOT_DISTURB']),
});

export async function setPresence(req: Request, res: Response) {
  const { workspaceUid } = req.params as { workspaceUid: string };
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return res.fail?.([{ message: 'Validation failed', code: 'VALIDATION_ERROR', details }], 400);
  }

  const userId = req.auth?.userId as string | undefined;
  if (!userId) return res.fail?.([{ message: 'Unauthorized', code: 'UNAUTHORIZED' }], 401);

  const ws = await findWorkspaceByUid(workspaceUid);
  if (!ws) return res.fail?.([{ message: 'Workspace not found', code: 'NOT_FOUND' }], 404);
  const member = await isWorkspaceMember(ws.uid, BigInt(userId));
  if (!member) return res.fail?.([{ message: 'Forbidden', code: 'FORBIDDEN' }], 403);

  await setUserPresenceStatus({ roomUid: ws.uid, identity: userId, status: parsed.data.status });
  return res.success?.({ ok: true }, 200);
}
