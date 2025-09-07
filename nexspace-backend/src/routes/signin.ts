// src/routes/google.ts
import { Router, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { createSession, setSessionCookie, DEFAULT_TTL, getSession, rotateSession } from "../session.js";
import { config } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../middleware/error.js";
import z from "zod";
import { prisma } from "../prisma.js";
import { verifyAndUpgrade } from "../utils/password.js";
import { passwordSchema } from "../utils/common.js";

const SigninSchema = z.object({
  email: z.email(),
  password: passwordSchema,
  remember: z.boolean().optional(), // if true, you may choose a longer TTL
});

interface GoogleCallbackBody {
  code: string;
  redirectUri?: string; // typically 'postmessage' for one-tap/popup flow
}

const router = Router();

const gClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret
);

// POST /api/auth/google/callback  body: { code, redirectUri: 'postmessage' }
router.post(
  "/google/callback",
  asyncHandler(async (req: Request<{}, {}, GoogleCallbackBody>, res: Response) => {
    const { code, redirectUri } = req.body ?? {};
    if (!code) {
      return res.fail([{ message: "Authorization code is required", code: "CODE_REQUIRED" }], 400);
    }

    // 1) Exchange code -> tokens
    let idToken: string | undefined;
    try {
      const { tokens } = await gClient.getToken({
        code,
        redirect_uri: redirectUri || "postmessage",
      });
      idToken = tokens.id_token ?? undefined;
    } catch (e: any) {
      throw new AppError("Failed to exchange Google auth code", 401, "GOOGLE_TOKEN_EXCHANGE_FAILED", {
        cause: e?.message ?? e,
      });
    }
    if (!idToken) {
      throw new AppError("ID token missing from Google response", 401, "NO_ID_TOKEN");
    }

    // 2) Verify ID token
    let email = "";
    let sub = "";
    let given_name = "";
    let family_name = "";
    try {
      const ticket = await gClient.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        throw new Error("Missing sub in ID token");
      }
      sub = payload.sub;
      email = (payload.email || "").toLowerCase();
      given_name = payload.given_name || "";
      family_name = payload.family_name || "";
    } catch (e: any) {
      throw new AppError("Invalid Google ID token", 401, "INVALID_ID_TOKEN", { cause: e?.message ?? e });
    }

    // 3) Create session (OAuth marker only; DB linking happens in /auth/me or onboarding)
    const sess = await createSession(
      {
        sub,
        email,
        firstName: given_name,
        lastName: family_name,
        provider: "google",
      } as any,
      DEFAULT_TTL
    );
    setSessionCookie(res as any, sess.sid);

    // 4) Standard success payload (frontend should call /api/auth/me next)
    return res.success({ isAuthenticated: true }, 200);
  })
);

// POST /api/auth/signin
router.post(
  "/signin",
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = SigninSchema.safeParse(req.body);
    if (!parsed.success) {
      const details = parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message }));
      return res.fail([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
    }
    const { email, password, remember } = parsed.data;
    const emailLc = email.trim().toLowerCase();

    // 1) Find user by email
    const user = await prisma.user.findUnique({
      where: { email: emailLc },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    // Use a single generic error to avoid account enumeration
    const invalid = () =>
      res.fail([{ message: "Invalid email or password", code: "INVALID_CREDENTIALS" }], 401);

    if (!user) return invalid();

    // 2) Get password record
    const login = await prisma.userLogin.findUnique({ where: { userId: user.id } });
    if (!login) return invalid(); // password not set (OAuth-only); treat as invalid

    // 3) Verify password (and upgrade hash if needed)
    const { ok, newHash } = await verifyAndUpgrade(login.hash, password);
    if (!ok) return invalid();

    if (newHash) {
      await prisma.userLogin.update({
        where: { userId: user.id },
        data: { hash: newHash, alg: "argon2id" },
      });
    }

    // 4) Ensure local AuthIdentity exists (idempotent)
    await prisma.authIdentity.upsert({
      where: { provider_providerId: { provider: "local", providerId: `local:${emailLc}` } },
      update: { lastLoginAt: new Date() },
      create: { userId: user.id, provider: "local", providerId: `local:${emailLc}`, lastLoginAt: new Date() },
    });

    // 5) Session: rotate if existing, else create new
    const sid = (req.cookies && (req.cookies as any).sid) as string | undefined;
    const ttl = remember ? 60 * 60 * 24 * 30 : DEFAULT_TTL; // 30d if remember, else your default

    let session = null;
    if (sid) {
      const existing = await getSession(sid); // check it's real
      if (existing) {
        session = await rotateSession(sid, ttl); // rotate to prevent fixation
      }
    }
    if (!session) {
      session = await createSession({ userId: String(user.id), email: user.email }, ttl);
    }

    // Set session cookie (httpOnly, sameSite=lax, secure in prod)
    setSessionCookie(res as any, session.sid);

    // 6) Done — frontend can call /auth/me next if it needs profile/workspaces
    return res.success({ isAuthenticated: true }, 200);
  })
);


export default router;
