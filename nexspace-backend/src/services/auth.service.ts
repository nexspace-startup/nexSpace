import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { config } from "../config/env.js";
import { verifyAndUpgrade } from "../utils/password.js";
import { prisma, Prisma } from "../prisma.js";
import { findAuthIdentity } from "../repositories/auth.repository.js";
import {
  findUserByEmail,
  getUserLoginByUserId,
  updateUserLoginHash,
  upsertLocalAuthIdentity,
} from "../repositories/user.repository.js";

type OAuthProfile = {
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
};

function normalizeGooglePayload(payload: TokenPayload | null | undefined): OAuthProfile {
  if (!payload?.sub || typeof payload.sub !== "string") {
    throw new Error("MISSING_SUB");
  }

  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  return {
    sub: payload.sub,
    email,
    given_name: typeof payload.given_name === "string" ? payload.given_name : "",
    family_name: typeof payload.family_name === "string" ? payload.family_name : "",
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

export async function googleExchangeAndVerify(code: string, redirectUri?: string): Promise<OAuthProfile> {
  const gClient = new OAuth2Client(config.google.clientId, config.google.clientSecret);
  const { tokens } = await gClient.getToken({ code, redirect_uri: redirectUri || "postmessage" });
  const idToken = tokens.id_token ?? undefined;
  if (!idToken) throw new Error("NO_ID_TOKEN");

  const ticket = await gClient.verifyIdToken({ idToken, audience: config.google.clientId });
  const payload = ticket.getPayload();

  return normalizeGooglePayload(payload);
}

export async function signInWithEmailPassword(email: string, password: string) {
  const emailLc = email.trim().toLowerCase();
  const user = await findUserByEmail(emailLc);
  if (!user) return { ok: false as const };

  const login = await getUserLoginByUserId(user.id);
  if (!login) return { ok: false as const };

  const { ok, newHash } = await verifyAndUpgrade(login.hash, password);
  if (!ok) return { ok: false as const };
  if (newHash) await updateUserLoginHash(user.id, newHash);
  await upsertLocalAuthIdentity(user.id, emailLc);

  return {
    ok: true as const,
    user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name },
  };
}

export async function googleVerifyIdToken(idToken: string): Promise<OAuthProfile> {
  const gClient = new OAuth2Client(config.google.clientId, config.google.clientSecret);
  const ticket = await gClient.verifyIdToken({ idToken, audience: config.google.clientId });
  const payload = ticket.getPayload();
  return normalizeGooglePayload(payload);
}

/** Ensure a DB user exists and is linked to the OAuth identity. Returns the userId. */
export async function ensureOAuthUser(args: {
  provider: "google" | "microsoft";
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<bigint> {
  const provider = args.provider;
  const sub = args.sub;
  const emailLc = (args.email || "").trim().toLowerCase();
  const first = (args.firstName || "").trim();
  const last = (args.lastName || "").trim();

  // 1) If identity already exists, return its userId
  const ident = await findAuthIdentity(provider, sub);
  if (ident?.userId) return ident.userId;

  // 2) If a user exists by email, link identity and refresh names/verifiedAt
  const existing = await prisma.user.findUnique({ where: { email: emailLc }, select: { id: true } });
  if (existing) {
    const userId = existing.id;
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.authIdentity.upsert({
        where: { provider_providerId: { provider, providerId: sub } },
        update: { lastLoginAt: new Date() },
        create: { userId, provider, providerId: sub, lastLoginAt: new Date() },
      });
      await tx.user.update({ where: { id: userId }, data: { first_name: first || undefined, last_name: last || undefined, displayName: [first, last].filter(Boolean).join(" ") || undefined, email: emailLc, emailVerifiedAt: new Date() } });
    });
    return userId;
  }

  // 3) Create a brand-new user and bind identity
  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({ data: { first_name: first || "", last_name: last || "", displayName: [first, last].filter(Boolean).join(" ") || null, email: emailLc, emailVerifiedAt: new Date() } });
    await tx.authIdentity.create({ data: { userId: user.id, provider, providerId: sub, lastLoginAt: new Date() } });
    return user;
  });
  return created.id;
}

