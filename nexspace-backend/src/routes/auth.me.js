import { Router } from 'express';
import { prisma } from '../prisma.js';
import { getSession } from '../session.js';

const router = Router();

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const { data: sess } = await getSession(req);
  if (!sess?.userId && !sess?.sub) return res.json({ isAuthenticated: false });
  let user = null, workspaces = [];
  if (sess?.userId) {
    user = await prisma.user.findUnique({
      where: { id: BigInt(sess.userId) },
      include: {
        memberships: {
          include: {
            workspace: { include: { _count: { select: { members: true } } } },
          },
        },
      },
    });
    if (!user) return res.json({ isAuthenticated: false });

    workspaces = user.memberships.map(m => ({
      id: m.workspace.id.toString(),
      uid: m.workspace.uid,
      name: m.workspace.name,
      company: m.workspace.company ?? null,
      teamSizeBand: m.workspace.teamSizeBand ?? null,
      memberCount: m.workspace._count.members,
      role: m.role,
    }));
  }


  res.json({
    isAuthenticated: true,
    user: {
      id: user?.id?.toString(),
      first_name: user?.first_name,
      last_name: user?.last_name,
      email: user?.email || sess.email,
    },
    workspaces,
  });
});

export default router;
