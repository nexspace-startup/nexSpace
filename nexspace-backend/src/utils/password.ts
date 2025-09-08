// src/utils/password.ts
import argon2 from "argon2";
import { createHmac } from "node:crypto";

/**
 * Normalize user input to avoid Unicode confusables.
 * Do NOT trim; passwords may intentionally include whitespace.
 */
export function normalizePassword(pw: string): string {
  return pw.normalize("NFKC");
}

/**
 * Optional app-wide pepper (base64). Keep in env/secret manager.
 * Generate with:  openssl rand -base64 32
 */
function applyPepper(pw: string): string {
  const p = process.env.PASSWORD_PEPPER;
  if (!p) return pw;
  return createHmac("sha256", Buffer.from(p, "base64"))
    .update(pw, "utf8")
    .digest("base64"); // compact bytes for KDF input
}

/**
 * Argon2id parameters (tunable via env).
 * Target ~200–500ms per hash on prod hardware.
 */
function buildArgon2HashOptions(): argon2.Options {
  const serverless = process.env.SERVERLESS === "1";
  const memoryCost = Number(
    process.env.ARGON2_MEMORY_KIB || (serverless ? 19_456 : 65_536) // ~19MB or 64MB
  );
  const timeCost = Number(process.env.ARGON2_TIME || (serverless ? 2 : 3));
  const parallelism = Number(process.env.ARGON2_PARALLELISM || 1);

  return {
    type: argon2.argon2id, // 👈 use argon2id
    memoryCost,
    timeCost,
    parallelism,
  };
}

/**
 * Hash → returns a PHC string that already includes algo, params & salt.
 * Store this PHC string in your DB.
 */
export async function hashPassword(password: string): Promise<string> {
  const input = applyPepper(normalizePassword(password));
  const options = buildArgon2HashOptions();
  return argon2.hash(input, options);
}

/**
 * Verify a password against a PHC string.
 * NOTE: argon2@0.44 verify() accepts only { secret? } as the 3rd arg.
 * We don't pass hashing params here.
 */
export async function verifyPassword(phc: string, password: string): Promise<boolean> {
  const input = applyPepper(normalizePassword(password));
  try {
    return await argon2.verify(phc, input);
  } catch {
    return false;
  }
}

/**
 * Optional: check if stored hash should be upgraded to current params.
 * argon2.needsRehash is available in recent versions; guard for compatibility.
 */
export function needsRehash(phc: string): boolean {
  const anyArgon2 = argon2 as any;
  if (typeof anyArgon2.needsRehash === "function") {
    return Boolean(anyArgon2.needsRehash(phc, buildArgon2HashOptions()));
  }
  return false;
}

/**
 * Verify and transparently upgrade the hash if params changed.
 * Usage:
 *   const { ok, newHash } = await verifyAndUpgrade(storedHash, dto.password)
 *   if (ok && newHash) await repo.updateHash(userId, newHash)
 */
export async function verifyAndUpgrade(
  phc: string,
  password: string
): Promise<{ ok: boolean; newHash?: string }> {
  const ok = await verifyPassword(phc, password);
  if (!ok) return { ok };

  if (needsRehash(phc)) {
    const newHash = await hashPassword(password);
    return { ok: true, newHash };
  }
  return { ok: true };
}
