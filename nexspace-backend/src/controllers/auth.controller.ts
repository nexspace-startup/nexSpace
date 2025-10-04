import type { Request, Response } from "express";
import { DEFAULT_TTL, createSession, rotateSession, setSessionCookie, clearSessionCookie, revokeSession } from "../session.js";
import { AppError } from "../middleware/error.js";
import { GoogleCallbackSchema, SigninSchema, CheckEmailSchema } from "../validators/authValidators.js";
import type { z } from "zod";
import { googleExchangeAndVerify, googleVerifyIdToken, signInWithEmailPassword, ensureOAuthUser } from "../services/auth.service.js";
import { findUserByEmail, seachByUsernameEmail } from "../repositories/user.repository.js";

export async function googleCallback(req: Request, res: Response) {
  // Coerce input to support both code and id token shapes; allow body or query
  const body: any = req.body || {};
  const shaped = {
    code: body.code ?? (req.query?.code as any) ?? body.authorizationCode ?? body.authCode,
    idToken: body.idToken ?? body.credential ?? (req.query?.id_token as any) ?? (req.query?.credential as any),
    redirectUri: body.redirectUri ?? (req.query?.redirect_uri as any),
    next: body.next ?? (req.query?.next as any),
  };
  const parsed = GoogleCallbackSchema.safeParse(shaped);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }

  const data = parsed.data as any;
  try {
    let profile: { sub: string; email: string; given_name: string; family_name: string; picture?: string };
    if (data.idToken || data.credential) {
      const idTok = data.idToken ?? data.credential;
      profile = await googleVerifyIdToken(idTok);
    } else {
      profile = await googleExchangeAndVerify(data.code, data.redirectUri);
    }
    const { sub, email, given_name, family_name } = profile;

    // If the sign-in is part of an invitation accept flow, provision the user now.
    // Otherwise, defer user creation until onboarding.
    const isInviteFlow = typeof data.next === 'string' && /^\s*\/invite\//.test(data.next);
    let sess;
    if (isInviteFlow) {
      const userIdBn = await ensureOAuthUser({ provider: "google", sub, email, firstName: given_name, lastName: family_name });
      sess = await createSession({
        userId: String(userIdBn),
        sub,
        email,
        firstName: given_name,
        lastName: family_name,
        provider: "google",
        avatar: profile.picture,
      }, DEFAULT_TTL);
    } else {
      // OAuth-first session, no DB user yet
      sess = await createSession({
        sub,
        email,
        firstName: given_name,
        lastName: family_name,
        provider: "google",
        avatar: profile.picture,
      }, DEFAULT_TTL);
    }
    setSessionCookie(res as any, sess.sid);
    return res.success?.({ isAuthenticated: true }, 200);
  } catch (e: any) {
    if (e?.message === "Redis not available") {
      return res.fail?.(
        [{ message: "Authentication temporarily unavailable", code: "AUTH_TEMPORARILY_UNAVAILABLE" }],
        503
      );
    }
    const msg = e?.message || "GOOGLE_CALLBACK_ERROR";
    if (msg === "NO_ID_TOKEN") throw new AppError("ID token missing from Google response", 401, "NO_ID_TOKEN");
    if (msg === "MISSING_SUB") throw new AppError("Invalid Google ID token", 401, "INVALID_ID_TOKEN");
    throw new AppError("Failed to exchange Google auth code", 401, "GOOGLE_TOKEN_EXCHANGE_FAILED", { cause: msg });
  }
}

export async function signin(req: Request, res: Response) {
  try {
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

    const sid = req.auth?.sid as string | undefined;
    const ttl = remember ? 60 * 60 * 24 * 30 : DEFAULT_TTL;

    let session = null as any;
    if (sid) {
      session = await rotateSession(sid, ttl);
    }
    if (!session) session = await createSession({ userId: String(result.user.id), email: result.user.email }, ttl);

    setSessionCookie(res as any, session.sid);
    return res.success?.({ isAuthenticated: true }, 200);
  } catch (e: any) {
    if (e?.message === "Redis not available") {
      return res.fail?.(
        [{ message: "Authentication temporarily unavailable", code: "AUTH_TEMPORARILY_UNAVAILABLE" }],
        503
      );
    }
    throw e;
  }
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

/**
 * POST /auth/logout
 * Clears the httpOnly cookie and revokes the server session (when Redis is available).
 * Always responds 200 to avoid leaking auth state via timing.
 */
export async function logout(req: Request, res: Response) {
  try {
    const sid: string | undefined = (req as any)?.auth?.sid || (req.cookies && (req.cookies as any).sid);
    if (sid) {
      try { await revokeSession(sid); } catch { }
    }
    clearSessionCookie(res as any);
    return res.success?.({ isAuthenticated: false }, 200);
  } catch {
    // Best-effort: clear cookie and return 200
    try { clearSessionCookie(res as any); } catch { }
    return res.success?.({ isAuthenticated: false }, 200);
  }
}

export async function searchUsers(req: Request, res: Response) {
  try {
    const q = (req.query?.q as string | undefined) ?? (req.body as any)?.q ?? "";
    const trimmed = String(q || "").trim();
    if (!trimmed) {
      return res.fail?.(
        [{ message: "Search term is required", code: "VALIDATION_ERROR" }],
        400
      );
    }

    const users = await seachByUsernameEmail(trimmed);
    const userList = users?.map(user => ({
      id: String(user.id),
      name: user.displayName,
      email: user.email
    }))
    return res.success?.({ userList }, 200);
  } catch (e: any) {
    return res.fail?.(
      [{ message: "Failed to search users", code: "SEARCH_USERS_ERROR", details: e?.message }],
      500
    );
  }
}
