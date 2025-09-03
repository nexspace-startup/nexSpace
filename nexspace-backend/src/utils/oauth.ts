import crypto from 'crypto';

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a Proof Key for Code Exchange (PKCE) challenge and verifier.
 * PKCE is used to prevent authorization code interception attacks.
 */
export function genPKCE(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(
    crypto.createHash('sha256').update(verifier).digest(),
  );

  return { verifier, challenge };
}

export function state(): string {
  return crypto.randomUUID();
}

export function nonce(): string {
  return b64url(crypto.randomBytes(16));
}
