import type { Request, Response } from "express";
import type { z } from "zod";
import { DEFAULT_TTL, createSession, setSessionCookie } from "../session.js";
import { OnboardingSchema, InvitationSchema, AcceptParams } from "../validators/setup.validators.js";
import { onboardingLocal, onboardingOAuth, createInvitationForWorkspace, acceptInvitation } from "../services/setup.service.js";

export async function onboarding(req: Request, res: Response) {
  const parsed = OnboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }
  const input = parsed.data;

  const sub = req.auth?.sub ?? null;
  const sessUserId = req.auth?.userId ?? null;
  const hintedProvider = req.auth?.provider as any | undefined;

  if (!sub) {
    if (!input.password) {
      return res.fail?.([{ message: "Password required", code: "PASSWORD_REQUIRED" }], 400);
    }
    try {
      const { payload, userId } = await onboardingLocal(input);
      if (!sessUserId) {
        const newSess = await createSession({ userId: String(userId), email: input.email.toLowerCase() }, DEFAULT_TTL);
        setSessionCookie(res as any, newSess.sid);
      }
      return res.success?.(payload, 201);
    } catch (e: any) {
      if (e?.message === "EMAIL_TAKEN") return res.fail?.([{ message: "Email already in use", code: "EMAIL_TAKEN" }], 409);
      if (e?.message === "WORKSPACE_CONFLICT") return res.fail?.([{ message: "WORKSPACE_ALREADY_EXISTS", code: "WORKSPACE_CONFLICT" }], 409);
      return res.fail?.([{ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" }], 500);
    }
  }

  // OAuth path
  try {
    const payload = await onboardingOAuth(input, sub, hintedProvider);
    return res.success?.(payload, 201);
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.fail?.([{ message: "Unique constraint violation", code: "UNIQUE_CONSTRAINT_VIOLATION", details: err.meta ?? null }], 409);
    }
    if (err?.message === "WORKSPACE_CONFLICT") return res.fail?.([{ message: "WORKSPACE_ALREADY_EXISTS", code: "WORKSPACE_CONFLICT" }], 409);
    return res.fail?.([{ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}

export async function invite(req: Request, res: Response) {
  const parsed = InvitationSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }
  const sessUserId = req.auth!.userId! as string;

  try {
    const { invitationurl, emailSent, reused } = await createInvitationForWorkspace(sessUserId, parsed.data);
    return res.success?.({ invitationurl, emailSent }, reused ? 200 : 201);
  } catch (e: any) {
    const code = e?.message;
    if (code === "INVITER_NOT_FOUND") return res.fail?.([{ message: "Inviter not found", code: "INVITER_NOT_FOUND" }], 403);
    if (code === "FORBIDDEN") return res.fail?.([{ message: "Forbidden", code: "FORBIDDEN" }], 403);
    return res.fail?.([{ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}

export async function acceptInvite(req: Request, res: Response) {
  const params = AcceptParams.safeParse(req.params);
  if (!params.success) {
    const details = params.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }
  const sessUserId = req.auth!.userId! as string;
  const sessEmail = req.auth!.email! as string;

  try {
    const payload = await acceptInvitation(params.data.token, sessUserId, sessEmail.toLowerCase());
    return res.success?.(payload, 200);
  } catch (e: any) {
    const code = e?.message;
    if (code === "NOT_FOUND") return res.fail?.([{ message: "Invitation not found", code: "NOT_FOUND" }], 404);
    if (code === "ALREADY_USED") return res.fail?.([{ message: "Invitation already used", code: "ALREADY_USED" }], 410);
    if (code === "EXPIRED") return res.fail?.([{ message: "Invitation expired", code: "EXPIRED" }], 410);
    if (code === "EMAIL_MISMATCH") return res.fail?.([{ message: "Signed-in email does not match invitation", code: "EMAIL_MISMATCH" }], 409);
    return res.fail?.([{ message: "Internal server error", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}
