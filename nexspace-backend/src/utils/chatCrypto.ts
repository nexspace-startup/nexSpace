import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Optional AES-256-GCM encryption for chat content at rest.
 * Provide a 32-byte key via env CHAT_ENC_KEY (hex or base64/base64url).
 */
function getKey(): Buffer | null {
  const raw = process.env.CHAT_ENC_KEY;
  if (!raw) return null;
  try {
    // try hex
    if (/^[0-9a-fA-F]+$/.test(raw) && (raw.length === 64)) return Buffer.from(raw, "hex");
    // try base64/base64url
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const buf = Buffer.from(normalized, "base64");
    if (buf.length === 32) return buf;
  } catch {}
  console.warn("[chatCrypto] CHAT_ENC_KEY is set but invalid; ignoring encryption.");
  return null;
}

const key = getKey();

export function maybeEncrypt(plain: string): string {
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64url")}:${enc.toString("base64url")}:${tag.toString("base64url")}`;
}

export function maybeDecrypt(stored: string): string {
  if (!stored.startsWith("enc:")) return stored;
  if (!key) return "[encrypted]";
  try {
    const [, ivB64, dataB64, tagB64] = stored.split(":");
    const iv = Buffer.from(ivB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return "[encrypted]";
  }
}

