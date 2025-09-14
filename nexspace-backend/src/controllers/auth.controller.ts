import type { Request, Response } from "express";
import { DEFAULT_TTL, createSession, getSession, rotateSession, setSessionCookie } from "../session.js";
import { AppError } from "../middleware/error.js";
import { GoogleCallbackSchema, SigninSchema, CheckEmailSchema } from "../validators/authValidators.js";
import type { z } from "zod";
import { googleExchangeAndVerify, signInWithEmailPassword } from "../services/auth.service.js";
import { findUserByEmail } from "../repositories/user.repository.js";

export async function googleCallback(req: Request, res: Response) {
  const parsed = GoogleCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }

  const { code, redirectUri } = parsed.data;
  try {
    const { sub, email, given_name, family_name } = await googleExchangeAndVerify(code, redirectUri);

    const sess = await createSession(
      { sub, email, firstName: given_name, lastName: family_name, provider: "google" },
      DEFAULT_TTL
    );
    setSessionCookie(res as any, sess.sid);
    return res.success?.({ isAuthenticated: true }, 200);
  } catch (e: any) {
    const msg = e?.message || "GOOGLE_CALLBACK_ERROR";
    if (msg === "NO_ID_TOKEN") throw new AppError("ID token missing from Google response", 401, "NO_ID_TOKEN");
    if (msg === "MISSING_SUB") throw new AppError("Invalid Google ID token", 401, "INVALID_ID_TOKEN");
    throw new AppError("Failed to exchange Google auth code", 401, "GOOGLE_TOKEN_EXCHANGE_FAILED", { cause: msg });
  }
}

export async function signin(req: Request, res: Response) {
  const parsed = SigninSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }

  const { email, password, remember } = parsed.data;
  const result = await signInWithEmailPassword(email, password);

  if (!result.ok) {
    return res.fail?.([{ message: "Invalid email or password", code: "INVALID_CREDENTIALS" }], 401);
  }

  const sid = (req.cookies && (req.cookies as any).sid) as string | undefined;
  const ttl = remember ? 60 * 60 * 24 * 30 : DEFAULT_TTL;

  let session = null as any;
  if (sid) {
    const existing = await getSession(sid);
    if (existing) session = await rotateSession(sid, ttl);
  }
  if (!session) session = await createSession({ userId: String(result.user.id), email: result.user.email }, ttl);

  setSessionCookie(res as any, session.sid);
  return res.success?.({ isAuthenticated: true }, 200);
}

export async function checkEmail(req: Request, res: Response) {
  const emailParam = (req.query?.email as string | undefined) ?? (req.body as any)?.email ?? "";
  const parsed = CheckEmailSchema.safeParse({ email: String(emailParam || "").trim() });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }
  const emailLc = parsed.data.email.toLowerCase();
  const user = await findUserByEmail(emailLc);
  return res.success?.({ exists: !!user }, 200);
}


