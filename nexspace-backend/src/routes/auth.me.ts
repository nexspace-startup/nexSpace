import { Router, Request, Response } from 'express';
import {
  prisma,
  WorkspaceRole,
  User,
  WorkspaceMember,
  Workspace,
} from '../prisma.js';
import { getSession, SessionData } from '../session.js';

const router = Router();

interface WorkspaceDTO {
  id: string;
  uid: string;
  name: string;
  memberCount: number;
  role: WorkspaceRole;
}

interface UserDTO {
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface MeResponse {
  isAuthenticated: boolean;
  user?: UserDTO;
  workspaces?: WorkspaceDTO[];
}

type UserWithMemberships = User & {
  memberships: Array<
    WorkspaceMember & {
      workspace: Workspace & { _count: { members: number } };
    }
  >;
};

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response<MeResponse>) => {
  const { data: sess } = await getSession(req);
  if (!sess?.userId && !sess?.sub)
    return res.json({ isAuthenticated: false });
  let user: UserWithMemberships | null = null;
  let workspaces: WorkspaceDTO[] = [];
  if (sess?.userId) {
    user = (await prisma.user.findUnique({
      where: { id: BigInt(sess.userId) },
      include: {
        memberships: {
          include: {
            workspace: { include: { _count: { select: { members: true } } } },
          },
        },
      },
    })) as UserWithMemberships | null;
    if (!user) return res.json({ isAuthenticated: false });

    workspaces = user.memberships.map(
      (
        m: WorkspaceMember & {
          workspace: Workspace & { _count: { members: number } };
        },
      ) => ({
      id: m.workspace.id.toString(),
      uid: m.workspace.uid,
      name: m.workspace.name,
      memberCount: m.workspace._count.members,
      role: m.role,
    }),
    );
  }

  res.json({
    isAuthenticated: true,
    user: {
      id: user?.id?.toString(),
      first_name: user?.first_name,
      last_name: user?.last_name,
      email: user?.email || (sess as SessionData).email,
    },
    workspaces,
  });
});

export default router;
