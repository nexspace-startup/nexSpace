// utils/oauth.js
import crypto from 'crypto';

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Generates a Proof Key for Code Exchange (PKCE) challenge and verifier.
 * PKCE is used to prevent authorization code interception attacks.
 *
 * @returns {Object} An object with `verifier` and `challenge` properties.
 *   Both properties are base64url-encoded strings.
 */
export function genPKCE() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());

  return { verifier, challenge };
}

export function state() {
  return crypto.randomUUID();
}

export function nonce() {
  return b64url(crypto.randomBytes(16));
}
