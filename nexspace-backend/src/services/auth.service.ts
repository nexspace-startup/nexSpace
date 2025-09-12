import { OAuth2Client } from "google-auth-library";
import { config } from "../config/env.js";
import { verifyAndUpgrade } from "../utils/password.js";
import {
  findUserByEmail,
  getUserLoginByUserId,
  updateUserLoginHash,
  upsertLocalAuthIdentity,
} from "../repositories/user.repository.js";

export async function googleExchangeAndVerify(code: string, redirectUri?: string) {
  const gClient = new OAuth2Client(config.google.clientId, config.google.clientSecret);
  const { tokens } = await gClient.getToken({ code, redirect_uri: redirectUri || "postmessage" });
  const idToken = tokens.id_token ?? undefined;
  if (!idToken) throw new Error("NO_ID_TOKEN");

  const ticket = await gClient.verifyIdToken({ idToken, audience: config.google.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("MISSING_SUB");

  return {
    sub: payload.sub,
    email: (payload.email || "").toLowerCase(),
    given_name: payload.given_name || "",
    family_name: payload.family_name || "",
  };
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

