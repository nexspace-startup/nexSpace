import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma, WorkspaceRole, Prisma } from '../prisma.js';
import { getSession } from '../session.js';

const router = Router();

const OnboardingSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),

  workspaceName: z.string().min(1).max(120),
  //company: z.string().min(1).max(120).optional(),
  //teamSize: z.number().int().positive().max(100000).optional(),

  role: z.nativeEnum(WorkspaceRole), // 'OWNER' | 'ADMIN' | 'MEMBER'
});

type OnboardingInput = z.infer<typeof OnboardingSchema>;

interface UserDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface WorkspaceDTO {
  id: string;
  uid: string;
  name: string;
}

interface MembershipDTO {
  role: WorkspaceRole;
}

interface OnboardingResponse {
  user: UserDTO;
  workspace: WorkspaceDTO;
  membership: MembershipDTO;
}

// POST /api/onboarding
router.post(
  '/onboarding',
  async (
    req: Request<{}, {}, OnboardingInput>,
    res: Response<OnboardingResponse | { error: string; meta?: unknown }>,
  ) => {
    const input = req.body;
    const { data: sess } = await getSession(req);
    if (!sess?.userId && !sess?.sub)
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Upsert user (dedupe by auth_provider_sub)
      const user = await tx.user.upsert({
        where: { auth_provider_sub: sess?.sub },
        update: {
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
        },
        create: {
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          auth_provider: "google",
          auth_provider_sub: sess?.sub!,
        },
      });

      // Optionally block duplicate workspace names per creator
      const duplicate = await tx.workspace.findFirst({
        where: { name: input.workspaceName, createdById: user.id },
        select: { id: true },
      });
      if (duplicate) {
        const err = new Error('WORKSPACE_ALREADY_EXISTS') as Error & {
          code?: string;
        };
        err.code = 'WORKSPACE_CONFLICT';
        throw err;
      }

      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: input.workspaceName,
          createdById: user.id,
        },
      });

      // Create membership (usually OWNER for creator)
      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: WorkspaceRole.OWNER,
        },
      });

      // Return JSON-safe DTO (BigInt → string)
      return {
        user: {
          id: user.id.toString(),
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
        },
        workspace: {
          id: workspace.id.toString(),
          uid: workspace.uid,
          name: workspace.name,
        },
        membership: {
          role: membership.role,
        },
      };
    });

      return res.status(201).json(result);
    } catch (err: any) {
      if (err?.code === 'WORKSPACE_CONFLICT') {
        return res.status(409).json({ error: 'WORKSPACE_ALREADY_EXISTS' });
      }
      // Prisma unique constraint collisions (e.g., email/auth_provider_sub)
      if (err?.code === 'P2002') {
        return res
          .status(409)
          .json({
            error: 'UNIQUE_CONSTRAINT_VIOLATION',
            meta: err.meta || null,
          });
      }
      console.error('Onboarding error:', err);
      return res
        .status(500)
        .json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  },
);

export default router;
