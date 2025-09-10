// src/routes/auth.me.ts
import { Router, type Request, type Response } from "express";
import {
  prisma,
  type User,
  type WorkspaceMember,
  type Workspace,
  WorkspaceRole,
} from "../prisma.js";
import {
  getSession,
  attachDbUserIdToSession,
  DEFAULT_TTL,
  isSessionValid,
} from "../session.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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

/**
 * HEAD /auth/session
 * Lightweight auth check (no 401). 204 when valid, 200 when not.
 */
router.head(
  "/session",
  asyncHandler(async (req, res) => {
    const sid = (req.cookies && (req.cookies as any).sid) as string | undefined;
    res.setHeader("Cache-Control", "no-store");

    if (!sid) return res.status(200).end();

    // Fast Redis EXISTS check
    const ok = await isSessionValid(sid);
    return res.status(ok ? 204 : 200).end();
  })
);

/**
 * GET /auth/me
 * Returns identity + memberships.
 * - If session has userId: fetch by id (fast path).
 * - Else if session has OAuth sub: resolve via AuthIdentity and attach userId into session.
 * - Else: unauthenticated.
 */
router.get(
  "/me",
  asyncHandler(async (req: Request, res: Response) => {
    const sid = (req.cookies && (req.cookies as any).sid) as string | undefined;
    console.log(sid);
    if (!sid) return res.success<MeResponse>({ isAuthenticated: false });

    const sess = await getSession(sid, DEFAULT_TTL);
    console.log(sess ,"sess");
    const sessUserId = (sess as any)?.userId as string | undefined;
    const sessSub = (sess as any)?.sub as string | undefined;
    const sessProvider = (sess as any)?.provider as "google" | "microsoft" | undefined;
    const sessEmail = (sess as any)?.email as string | undefined;

    // No identity material in session
    if (!sessUserId && !sessSub) {
      console.log("no sess user id or sub");
      return res.success<MeResponse>({ isAuthenticated: false });
    }

    let user: UserWithMemberships | null = null;

    // ---------- FAST PATH: DB userId already in session ----------
    if (sessUserId) {
      user = await prisma.user.findUnique({
        where: { id: BigInt(sessUserId) },
        include: {
          memberships: {
            include: {
              workspace: { include: { _count: { select: { members: true } } } },
            },
          },
        },
      });

      // If user row somehow missing, still treat as authenticated (session is valid),
      // but return minimal identity from session.
      if (!user) {
        return res.success<MeResponse>({
          isAuthenticated: true,
          user: { id: sessUserId, email: sessEmail },
          workspaces: [],
        });
      }
    }

    // ---------- OAUTH PATH: resolve via AuthIdentity then attach ----------
    if (!user && sessSub) {
      // If provider is known, check that first, then the other provider as fallback.
      const tryProviders = sessProvider
        ? ([sessProvider, sessProvider === "google" ? "microsoft" : "google"] as const)
        : (["google", "microsoft"] as const);

      let identity = null as { userId: bigint } | null;

      for (const p of tryProviders) {
        identity = await prisma.authIdentity.findUnique({
          where: { provider_providerId: { provider: p, providerId: sessSub } },
          select: { userId: true },
        });
        if (identity) break;
      }

      if (identity) {
        user = await prisma.user.findUnique({
          where: { id: identity.userId },
          include: {
            memberships: {
              include: {
                workspace: { include: { _count: { select: { members: true } } } },
              },
            },
          },
        });

        // Attach DB userId to session so future calls are fast
        if (user) {
          await attachDbUserIdToSession(
            sid,
            String(user.id),
            user.first_name ?? "",
            user.last_name ?? "",
            DEFAULT_TTL
          );
        }
      }
    }

    // ---------- First-time OAuth user (no DB row yet) ----------
    if (!user) {
      // OAuth is valid but we haven't created a DB user yet (onboarding flow)
      return res.success<MeResponse>({
        isAuthenticated: true,
        user: { email: sessEmail },
        workspaces: [],
      });
    }

    // ---------- Build DTO ----------
    const workspaces: WorkspaceDTO[] = user.memberships.map((m) => ({
      id: String(m.workspace.id),
      uid: m.workspace.uid,
      name: m.workspace.name,
      memberCount: m.workspace._count.members,
      role: m.role,
    }));

    return res.success<MeResponse>({
      isAuthenticated: true,
      user: {
        id: String(user.id),
        first_name: user.first_name ?? undefined,
        last_name: user.last_name ?? undefined,
        email: user.email ?? sessEmail,
      },
      workspaces,
    });
  })
);

export default router;
