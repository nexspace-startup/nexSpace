import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../prisma.js';
import { setSession } from '../session.js';
import { config } from '../config/env.js';

interface GoogleCallbackBody {
  code: string;
  redirectUri?: string;
}

const router = Router();

const gClient = new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
);

// POST /api/auth/google/callback  body: { code, redirectUri: 'postmessage' }
router.post(
  '/google/callback',
  async (
    req: Request<{}, {}, GoogleCallbackBody>,
    res: Response,
  ) => {
    const { code, redirectUri } = req.body || {};
    if (!code) return res.status(400).json({ error: 'CODE_REQUIRED' });

    try {
        // Exchange the code (GIS already handled PKCE)
        const { tokens } = await gClient.getToken({
            code,
            // using 'postmessage' popup flow
            redirect_uri: redirectUri || 'postmessage',
        });

        // Verify ID token integrity
        const idToken = tokens.id_token;
        if (!idToken) return res.status(401).json({ error: 'NO_ID_TOKEN' });

        const ticket = await gClient.verifyIdToken({
            idToken,
            audience: config.google.clientId,
        });
        const profile = ticket.getPayload(); // { sub, email, given_name, family_name, ... }
        if (!profile?.sub) return res.status(401).json({ error: 'INVALID_ID_TOKEN' });
        let user = await prisma.user.findUnique({
            where: { auth_provider_sub: profile.sub },
            include: { memberships: { include: { workspace: true } } }
        });
        let memberships = [];
        if (user) {
            // Fetch the workspaces the user is part of
            memberships = await prisma.workspaceMember.findMany({
                where: { userId: user.id },
                select: { workspaceId: true },
            });
        }

        await setSession(res, {
            userId: user?.id?.toString(), // BigInt → string for JSON
            sub: profile.sub,
            email: profile.email,
            wids: memberships?.map(m => m.workspaceId.toString()),
        });
        // no body; the frontend calls /api/auth/me next
        res.status(204).end();
    } catch (e) {
        console.error('google callback error', e);
        res.status(401).json({ error: 'AUTH_FAILED' });
    }
  },
);

export default router;
