import { prisma, Prisma, WorkspaceRole, InvitationStatus } from "../prisma.js";
import type { OnboardingInput, InvitationInput } from "../validators/setup.validators.js";
import { hashPassword } from "../utils/password.js";
import { config } from "../config/env.js";
import { sendInviteEmail } from "../utils/mailer.js";
import { CacheKeys, CacheTTL, invalidateCache, setCache } from "../utils/cache.js";

type AuthProvider = "google" | "microsoft" | "local";

export type OnboardingResult = {
  user: { id: string; firstName: string; lastName: string; email: string };
  workspace: { uid: string; name: string };
  membership: { role: WorkspaceRole };
};

async function resolveOAuthProvider(sub: string, hinted?: AuthProvider | string | null): Promise<AuthProvider> {
  if (hinted && (hinted === "google" || hinted === "microsoft")) return hinted as AuthProvider;
  const g = await prisma.authIdentity.findUnique({ where: { provider_providerId: { provider: "google", providerId: sub } }, select: { userId: true } });
  if (g) return "google";
  const m = await prisma.authIdentity.findUnique({ where: { provider_providerId: { provider: "microsoft", providerId: sub } }, select: { userId: true } });
  if (m) return "microsoft";
  return "google";
}

async function refreshWorkspaceCachesForUser(
  userId: bigint | string,
  workspaceUid: string,
  workspaceName: string,
  role: WorkspaceRole
) {
  const userIdStr = typeof userId === "bigint" ? userId.toString() : String(userId);
  await Promise.all([
    setCache(CacheKeys.workspace(workspaceUid), { uid: workspaceUid, name: workspaceName }, CacheTTL.workspace),
    setCache(CacheKeys.workspaceMember(workspaceUid, userIdStr), { role }, CacheTTL.workspaceMember),
    invalidateCache(
      CacheKeys.userProfile(userIdStr),
      CacheKeys.userWorkspaces(userIdStr),
      CacheKeys.workspaceMembers(workspaceUid)
    ),
  ]);
}

export async function onboardingLocal(input: OnboardingInput): Promise<{ payload: OnboardingResult; userId: bigint }> {
  const email = input.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const existingPwd = await prisma.userLogin.findUnique({ where: { userId: user.id } });
    if (existingPwd) throw new Error("EMAIL_TAKEN");
    const phc = await hashPassword(input.password || "");
    const existingUserId = user.id;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: existingUserId },
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          displayName: `${input.firstName} ${input.lastName}`.trim(),
          email,
        },
      });
      await tx.userLogin.upsert({
        where: { userId: existingUserId },
        update: { hash: phc, alg: "argon2id" },
        create: { userId: existingUserId, hash: phc, alg: "argon2id" },
      });
      await tx.authIdentity.upsert({
        where: { provider_providerId: { provider: "local", providerId: `local:${email}` } },
        update: { lastLoginAt: new Date() },
        create: { userId: existingUserId, provider: "local", providerId: `local:${email}`, lastLoginAt: new Date() },
      });
    });
  } else {
    const phc = await hashPassword(input.password || "");
    user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdUser = await tx.user.create({
        data: {
          first_name: input.firstName,
          last_name: input.lastName,
          displayName: `${input.firstName} ${input.lastName}`.trim(),
          email,
          emailVerifiedAt: null,
        },
      });
      await tx.userLogin.create({ data: { userId: createdUser.id, hash: phc, alg: "argon2id" } });
      await tx.authIdentity.create({ data: { userId: createdUser.id, provider: "local", providerId: `local:${email}` } });
      return createdUser;
    });
  }

  if (!user) {
    throw new Error("USER_NOT_CREATED");
  }

  const userId = user.id;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const dup = await tx.workspace.findFirst({ where: { name: input.workspaceName, createdById: userId }, select: { uid: true } });
    if (dup) throw new Error("WORKSPACE_CONFLICT");

    const workspace = await tx.workspace.create({ data: { name: input.workspaceName, createdById: userId } });
    const membership = await tx.workspaceMember.create({ data: { workspaceUid: workspace.uid, userId, role: input.role } });
    const payload: OnboardingResult = {
      user: { id: String(userId), firstName: input.firstName, lastName: input.lastName, email },
      workspace: { uid: workspace.uid, name: workspace.name },
      membership: { role: membership.role },
    };
    return payload;
  });

  await refreshWorkspaceCachesForUser(userId, result.workspace.uid, result.workspace.name, result.membership.role);

  return { payload: result, userId };
}

export async function onboardingOAuth(input: OnboardingInput, sub: string, hinted?: AuthProvider | string | null): Promise<OnboardingResult> {
  const email = input.email.trim().toLowerCase();
  const provider = await resolveOAuthProvider(sub, hinted);

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    let identity = await tx.authIdentity.findUnique({ where: { provider_providerId: { provider, providerId: sub } }, select: { userId: true } });

    let userId: bigint;
    if (identity) {
      userId = identity.userId;
      await tx.user.update({ where: { id: userId }, data: { first_name: input.firstName, last_name: input.lastName, displayName: `${input.firstName} ${input.lastName}`.trim(), email, emailVerifiedAt: new Date() } });
    } else {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        userId = existing.id;
        await tx.authIdentity.create({ data: { userId, provider, providerId: sub } });
        await tx.user.update({ where: { id: userId }, data: { first_name: input.firstName, last_name: input.lastName, displayName: `${input.firstName} ${input.lastName}`.trim(), emailVerifiedAt: new Date() } });
      } else {
        const created = await tx.user.create({ data: { first_name: input.firstName, last_name: input.lastName, displayName: `${input.firstName} ${input.lastName}`.trim(), email, emailVerifiedAt: new Date() } });
        userId = created.id;
        await tx.authIdentity.create({ data: { userId, provider, providerId: sub } });
      }
    }

    const dup = await tx.workspace.findFirst({ where: { name: input.workspaceName, createdById: userId }, select: { uid: true } });
    if (dup) throw new Error("WORKSPACE_CONFLICT");

    const workspace = await tx.workspace.create({ data: { name: input.workspaceName, createdById: userId } });
    const membership = await tx.workspaceMember.create({ data: { workspaceUid: workspace.uid, userId, role: input.role } });
    return {
      user: { id: String(userId), firstName: input.firstName, lastName: input.lastName, email },
      workspace: { uid: workspace.uid, name: workspace.name },
      membership: { role: membership.role },
    } satisfies OnboardingResult;
  });

  await refreshWorkspaceCachesForUser(result.user.id, result.workspace.uid, result.workspace.name, result.membership.role);

  return result;
}

export async function createInvitationForWorkspace(inviterUserId: string, input: InvitationInput) {
  const emailNorm = input.email.trim().toLowerCase();

  const inviter = await prisma.user.findUnique({ where: { id: BigInt(inviterUserId) }, select: { id: true, first_name: true, last_name: true } });
  if (!inviter) throw new Error("INVITER_NOT_FOUND");

  const canInvite = await prisma.workspaceMember.findFirst({ where: { workspaceUid: input.workspaceUid, userId: inviter.id, role: { in: ["OWNER", "ADMIN"] } }, select: { userId: true } });
  if (!canInvite) throw new Error("FORBIDDEN");

  const existing = await prisma.invitation.findFirst({
    where: { invitedEmail: emailNorm, workspaceUid: input.workspaceUid, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
    include: { workspace: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const invitation =
    existing ??
    (await prisma.invitation.create({
      data: {
        invitedEmail: emailNorm,
        workspaceUid: input.workspaceUid,
        invitedBy: inviter.id,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        role: WorkspaceRole.MEMBER,
      },
      include: { workspace: { select: { name: true } } },
    }));

  let emailSent = true;
  try {
    await sendInviteEmail({
      to: invitation.invitedEmail,
      invitationId: invitation.id,
      workspaceName: invitation.workspace?.name ?? "",
      inviterName: [inviter.first_name, inviter.last_name].filter(Boolean).join(" ") || undefined,
    });
  } catch {
    emailSent = false;
    // Log the root cause from SendGrid if available
    // We keep API behavior unchanged but surface errors to console for debugging
    // eslint-disable-next-line no-console
    console.error('[Invite] Failed to send invitation email. Check SENDGRID config and verified sender.');
  }

  const origin = config.webOrigin ?? config.appOrigin ?? "http://localhost:5173";
  const invitationUrl = `${origin}/invite/${invitation.id}`;
  return { invitationUrl, emailSent, reused: !!existing } as const;
}

export async function acceptInvitation(token: string, userId: string, email: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: token }, include: { workspace: { select: { uid: true, name: true } } } });
  if (!invite) throw new Error("NOT_FOUND");
  if (invite.status !== InvitationStatus.PENDING) throw new Error("ALREADY_USED");
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.invitation.update({ where: { id: invite.id }, data: { status: InvitationStatus.EXPIRED } });
    throw new Error("EXPIRED");
  }
  if (invite.invitedEmail.toLowerCase() !== email.toLowerCase()) throw new Error("EMAIL_MISMATCH");

  const outcome = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const claimed = await tx.invitation.updateMany({ where: { id: invite.id, status: InvitationStatus.PENDING }, data: { status: InvitationStatus.ACCEPTED, updatedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("ALREADY_USED");

    const existing = await tx.workspaceMember.findFirst({ where: { workspaceUid: invite.workspaceUid, userId: BigInt(userId) }, select: { userId: true } });
    if (!existing) {
      await tx.workspaceMember.create({ data: { workspaceUid: invite.workspaceUid, userId: BigInt(userId), role: invite.role ?? WorkspaceRole.MEMBER } });
    }
    return { alreadyMember: !!existing };
  });

  if (!outcome.alreadyMember) {
    await refreshWorkspaceCachesForUser(
      BigInt(userId),
      invite.workspace?.uid ?? invite.workspaceUid,
      invite.workspace?.name ?? "",
      invite.role ?? WorkspaceRole.MEMBER
    );
  } else {
    await invalidateCache(
      CacheKeys.userProfile(userId),
      CacheKeys.userWorkspaces(userId),
      CacheKeys.workspaceMembers(invite.workspaceUid)
    );
  }

  return {
    accepted: true,
    alreadyMember: outcome.alreadyMember,
    workspaceUid: invite.workspace?.uid ?? invite.workspaceUid,
    workspaceName: invite.workspace?.name ?? "",
  } as const;
}

