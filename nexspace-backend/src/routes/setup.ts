// src/routes/onboarding.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma, Prisma } from "../prisma.js";
import { WorkspaceRole, AuthProvider, InvitationStatus } from "@prisma/client";
import {
  getSession,
  DEFAULT_TTL,
  createSession,
  setSessionCookie,
} from "../session.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/error.js";
import { config } from "../config/env.js";
import { sendInviteEmail } from "../utils/mailer.js";
import { hashPassword } from "../utils/password.js";
import { nameSchemaWithoutSpaces, passwordSchema } from "../utils/common.js";

const router = Router();

/* --------------------------- Zod Schemas --------------------------- */

const OnboardingSchema = z.object({
  firstName: nameSchemaWithoutSpaces,
  lastName: nameSchemaWithoutSpaces,
  email: z.email(),
  password: passwordSchema.optional(), // required only when NOT OAuth
  workspaceName: z.string().min(1).max(120),
  company: z.string().optional(),  // future use
  teamSize: z.string().optional(), // future use
  role: z.enum(WorkspaceRole).default(WorkspaceRole.OWNER),
});

const InvitationSchema = z.object({
  email: z.string().email(),
  workspaceId: z.number().int().positive(),
});

const AcceptParams = z.object({
  token: z.string().uuid(), // Invitation.id is UUID
});

/* --------------------------- DTO Types --------------------------- */

interface OnboardingResponse {
  user: { id: string; firstName: string; lastName: string; email: string };
  workspace: { id: string; uid: string; name: string };
  membership: { role: WorkspaceRole };
}

interface InvitationResponse {
  invitationurl: string;
  emailSent: boolean;
}

/* --------------------------- Helpers --------------------------- */

async function requireSession(req: Request) {
  const sid = req.cookies?.sid as string | undefined;
  if (!sid) return null;
  return getSession(sid, DEFAULT_TTL); // sliding TTL
}

function validationFail(res: Response, issues: z.ZodIssue[]) {
  const details = issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return res.fail([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
}

/** Try to detect provider from session or DB; fallback to google if unknown. */
async function resolveOAuthProvider(sub: string, hinted?: AuthProvider | string | null): Promise<AuthProvider> {
  if (hinted && (hinted === "google" || hinted === "microsoft")) {
    return hinted as AuthProvider;
  }
  const g = await prisma.authIdentity.findUnique({
    where: { provider_providerId: { provider: "google", providerId: sub } },
    select: { userId: true },
  });
  if (g) return "google";
  const m = await prisma.authIdentity.findUnique({
    where: { provider_providerId: { provider: "microsoft", providerId: sub } },
    select: { userId: true },
  });
  if (m) return "microsoft";
  return "google"; // default
}

/* ============================= Routes ============================= */

/**
 * POST /api/onboarding
 * If session has sub → OAuth path (Google/Microsoft).
 * Else → Local path (email + password required) and set a session.
 * Creates workspace + membership for the user.
 */
router.post(
  "/onboarding",
  asyncHandler(async (req: Request<{}, {}, z.infer<typeof OnboardingSchema>>, res: Response) => {
    const parsed = OnboardingSchema.safeParse(req.body);
    if (!parsed.success) return validationFail(res, parsed.error.issues);
    const input = parsed.data;
    const email = input.email.trim().toLowerCase();

    const sess = await requireSession(req);
    const sub = (sess as any)?.sub ?? null;           // presence => OAuth
    const sessUserId = (sess as any)?.userId ?? null; // may exist already (fast path)
    const hintedProvider = (sess as any)?.provider as AuthProvider | undefined;

    /* ---------- LOCAL PATH (no sub) ---------- */
    if (!sub) {
      if (!input.password) {
        return res.fail([{ message: "Password required", code: "PASSWORD_REQUIRED" }], 400);
      }

      let user = await prisma.user.findUnique({ where: { email: email } });

      if (user) {
        const existingPwd = await prisma.userLogin.findUnique({ where: { userId: user.id } });
        if (existingPwd) {
          return res.fail([{ message: "Email already in use", code: "EMAIL_TAKEN" }], 409);
        }
        const phc = await hashPassword(input.password);
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user!.id },
            data: {
              first_name: input.firstName,
              last_name: input.lastName,
              displayName: `${input.firstName} ${input.lastName}`.trim(),
              email: email,
            },
          });
          await tx.userLogin.upsert({
            where: { userId: user!.id },
            update: { hash: phc, alg: "argon2id" },
            create: { userId: user!.id, hash: phc, alg: "argon2id" },
          });
          await tx.authIdentity.upsert({
            where: { provider_providerId: { provider: "local", providerId: `local:${email}` } },
            update: {},
            create: { userId: user!.id, provider: "local", providerId: `local:${email}` },
          });
        });
      } else {
        const phc = await hashPassword(input.password);
        user = await prisma.$transaction(async (tx) => {
          const u = await tx.user.create({
            data: {
              first_name: input.firstName,
              last_name: input.lastName,
              displayName: `${input.firstName} ${input.lastName}`.trim(),
              email: email,
              emailVerifiedAt: null,
            },
          });
          await tx.userLogin.create({ data: { userId: u.id, hash: phc, alg: "argon2id" } });
          await tx.authIdentity.create({
            data: { userId: u.id, provider: "local", providerId: `local:${email}` },
          });
          return u;
        });
      }

      // Create workspace + membership
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const dup = await tx.workspace.findFirst({
          where: { name: input.workspaceName, createdById: (user as any).id },
          select: { id: true },
        });
        if (dup) throw new AppError("WORKSPACE_ALREADY_EXISTS", 409, "WORKSPACE_CONFLICT");

        const workspace = await tx.workspace.create({
          data: { name: input.workspaceName, createdById: (user as any).id },
        });
        const membership = await tx.workspaceMember.create({
          data: { workspaceId: workspace.id, userId: (user as any).id, role: input.role },
        });

        const payload: OnboardingResponse = {
          user: {
            id: String((user as any).id),
            firstName: input.firstName,
            lastName: input.lastName,
            email: email,
          },
          workspace: { id: String(workspace.id), uid: workspace.uid, name: workspace.name },
          membership: { role: membership.role },
        };
        return payload;
      });

      // Ensure session exists (local path likely had no session)
      if (!sessUserId) {
        const newSess = await createSession({ userId: String((user as any).id),  email: email }, DEFAULT_TTL);
        setSessionCookie(res as any, newSess.sid);
      }

      return res.success<OnboardingResponse>(result, 201);
    }

    /* ---------- OAUTH PATH (sub exists) ---------- */
    const provider = await resolveOAuthProvider(sub, hintedProvider);

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Find or create user by identity
        let identity = await tx.authIdentity.findUnique({
          where: { provider_providerId: { provider, providerId: sub } },
          select: { userId: true },
        });

        let userId: bigint;
        if (identity) {
          userId = identity.userId;
          await tx.user.update({
            where: { id: userId },
            data: {
              first_name: input.firstName,
              last_name: input.lastName,
              displayName: `${input.firstName} ${input.lastName}`.trim(),
              email: email,
              emailVerifiedAt: new Date(),
            },
          });
        } else {
          const existing = await tx.user.findUnique({ where: { email: email } });
          if (existing) {
            userId = existing.id;
            await tx.authIdentity.create({
              data: { userId, provider, providerId: sub },
            });
            await tx.user.update({
              where: { id: userId },
              data: {
                first_name: input.firstName,
                last_name: input.lastName,
                displayName: `${input.firstName} ${input.lastName}`.trim(),
                emailVerifiedAt: new Date(),
              },
            });
          } else {
            const created = await tx.user.create({
              data: {
                first_name: input.firstName,
                last_name: input.lastName,
                displayName: `${input.firstName} ${input.lastName}`.trim(),
                email: email,
                emailVerifiedAt: new Date(),
              },
            });
            userId = created.id;
            await tx.authIdentity.create({
              data: { userId, provider, providerId: sub },
            });
          }
        }

        // Prevent duplicate workspace name for same creator (optional)
        const dup = await tx.workspace.findFirst({
          where: { name: input.workspaceName, createdById: userId },
          select: { id: true },
        });
        if (dup) throw new AppError("WORKSPACE_ALREADY_EXISTS", 409, "WORKSPACE_CONFLICT");

        // Create workspace + membership
        const workspace = await tx.workspace.create({
          data: { name: input.workspaceName, createdById: userId },
        });
        const membership = await tx.workspaceMember.create({
          data: { workspaceId: workspace.id, userId, role: input.role },
        });

        // NOTE: Do NOT attach DB userId to session here.
        // /auth/me will attach it lazily on the next call, per your design.

        const payload: OnboardingResponse = {
          user: {
            id: String(userId),
            firstName: input.firstName,
            lastName: input.lastName,
            email: email,
          },
          workspace: { id: String(workspace.id), uid: workspace.uid, name: workspace.name },
          membership: { role: membership.role },
        };
        return payload;
      });

      return res.success<OnboardingResponse>(result, 201);
    } catch (err: any) {
      if (err?.code === "P2002") {
        return res.fail(
          [{ message: "Unique constraint violation", code: "UNIQUE_CONSTRAINT_VIOLATION", details: err.meta ?? null }],
          409
        );
      }
      if (err instanceof AppError && err.statusCode === 409) {
        return res.fail([{ message: err.message, code: err.code ?? "CONFLICT" }], 409);
      }
      throw new AppError("Internal server error", 500, "INTERNAL_SERVER_ERROR", { cause: err?.message ?? err });
    }
  })
);

/**
 * POST /api/invite
 * Create an invitation for a workspace (OWNER/ADMIN only) and email it.
 */
router.post(
  "/invite",
  asyncHandler(async (req: Request<{}, {}, z.infer<typeof InvitationSchema>>, res: Response) => {
    const parsed = InvitationSchema?.safeParse(req?.body);
    if (!parsed?.success) return validationFail(res, parsed?.error?.issues);

    const rawEmail = parsed?.data?.email;
    const emailNorm = rawEmail?.trim()?.toLowerCase();
    const workspaceIdBig = BigInt(parsed?.data?.workspaceId);

    const sess = await requireSession(req);
    const sessUserId = (sess as any)?.userId;
    if (!sessUserId) return res?.fail([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401);

    const inviter = await prisma?.user?.findUnique({
      where: { id: BigInt(sessUserId) },
      select: { id: true, first_name: true, last_name: true },
    });
    if (!inviter) return res?.fail([{ message: "Inviter not found", code: "INVITER_NOT_FOUND" }], 403);

    const canInvite = await prisma?.workspaceMember?.findFirst({
      where: { workspaceId: workspaceIdBig, userId: inviter?.id, role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
    });
    if (!canInvite) return res?.fail([{ message: "Forbidden", code: "FORBIDDEN" }], 403);

    // 1) Look for existing pending (unexpired) invitation
    const existing = await prisma.invitation.findFirst({
      where: {
        invitedEmail: emailNorm,
        workspaceId: workspaceIdBig,
        status: InvitationStatus?.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: { workspace: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // 2) Create only if none
    const invitation = existing ?? (await prisma.invitation.create({
      data: {
        invitedEmail: emailNorm ?? "",
        workspaceId: workspaceIdBig,
        invitedBy: inviter?.id,
        status: InvitationStatus?.PENDING,
        expiresAt: new Date(Date?.now() + 7 * 24 * 3600 * 1000),
        role: WorkspaceRole?.MEMBER,
      },
      include: { workspace: { select: { name: true } } },
    }));

    // 3) Send (or re-send) email
    let emailSent = true;
    try {
      await sendInviteEmail({
        to: invitation?.invitedEmail,
        invitationId: invitation?.id as any, // UUID/string in your schema
        workspaceName: invitation?.workspace?.name ?? "",
        inviterName: [inviter?.first_name, inviter?.last_name]?.filter(Boolean)?.join(" ") || undefined,
      });
    } catch (e) {
      console.error("Failed to send invite email:", e);
      emailSent = false;
    }

    const origin = (config as any)?.webOrigin ?? (config as any)?.appOrigin ?? "http://localhost:5173";
    const result: InvitationResponse = {
      invitationurl: `${origin}/invite/${invitation?.id}`,
      emailSent,
    };

    // 200 if reused, 201 if newly created
    return res?.success?.<InvitationResponse>(result, existing ? 200 : 201);
  })
);


/**
 * POST /api/invitations/:token/accept
 * Accept an invitation (auth required). Race-safe & idempotent.
 */
router.post(
  "/invitations/:token/accept",
  asyncHandler(async (req: Request, res: Response) => {
    const params = AcceptParams.safeParse(req.params);
    if (!params.success) return validationFail(res, params.error.issues);
    const { token } = params.data;

    const sess = await requireSession(req);
    const sessUserId = (sess as any)?.userId;
    const sessEmail = (sess as any)?.email?.toLowerCase() as string | undefined;
    if (!sessUserId || !sessEmail) {
      return res.fail([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401);
    }

    const invite = await prisma.invitation.findUnique({
      where: { id: token },
      include: { workspace: { select: { id: true, uid: true, name: true } } },
    });
    if (!invite) return res.fail([{ message: "Invitation not found", code: "NOT_FOUND" }], 404);

    if (invite.status !== InvitationStatus.PENDING) {
      return res.fail([{ message: "Invitation already used or revoked", code: "ALREADY_USED" }], 410);
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await prisma.invitation.update({ where: { id: invite.id }, data: { status: InvitationStatus.EXPIRED } });
      return res.fail([{ message: "Invitation expired", code: "EXPIRED" }], 410);
    }

    if (invite.invitedEmail.toLowerCase() !== sessEmail) {
      return res.fail([{ message: "Signed-in email does not match invitation", code: "EMAIL_MISMATCH" }], 409);
    }

    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const claimed = await tx.invitation.updateMany({
          where: { id: invite.id, status: InvitationStatus.PENDING },
          data: { status: InvitationStatus.ACCEPTED, updatedAt: new Date() },
        });
        if (claimed.count !== 1) throw new Error("INVITE_ALREADY_USED");

        const existing = await tx.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: BigInt(sessUserId) } },
          select: { userId: true },
        });
        if (!existing) {
          await tx.workspaceMember.create({
            data: {
              workspaceId: invite.workspaceId,
              userId: BigInt(sessUserId),
              role: invite.role ?? WorkspaceRole.MEMBER,
            },
          });
        }
        return { alreadyMember: !!existing };
      });

      return res.success(
        {
          accepted: true,
          alreadyMember: outcome.alreadyMember,
          workspaceId: String(invite.workspaceId),
          workspaceUid: invite.workspace.uid,
          workspaceName: invite.workspace.name,
        },
        200
      );
    } catch (e: any) {
      if (e?.message === "INVITE_ALREADY_USED") {
        return res.fail([{ message: "Invitation already used", code: "ALREADY_USED" }], 410);
      }
      throw new AppError("Internal server error", 500, "INTERNAL_SERVER_ERROR", { cause: e?.message ?? e });
    }
  })
);

export default router;
