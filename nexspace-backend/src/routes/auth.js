// routes/auth.js
import express from 'express';
import { genPKCE, state as genState, nonce as genNonce } from '../utils/oauth.js'; // ensure you export nonce generator
import { config } from '../config/env.js';

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
export function createAuthRouter({ googleClient, msClient }) {
  const router = express.Router();

  function beginAuth(client, { scope, redirect_uri }, key) {
    return async (req, res, next) => {
      try {
        const { verifier, challenge } = genPKCE();
        const state = genState();
        const nonce = genNonce();

        // store EXACT property names you'll read later
        req.session[key] = { code_verifier: verifier, state, nonce };

        // openid-client expects code_challenge, not "challenge"
        const url = client.authorizationUrl({
          scope,
          redirect_uri,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state,
          nonce
        });

        res.redirect(url);
      } catch (e) { next(e); }
    };
  }

  function handleCallback(client, { redirect_uri }, key) {
    return async (req, res, next) => {
      try {
        const saved = req.session[key] || {};
        const params = client.callbackParams(req);

        const tokenSet = await client.callback(redirect_uri, params, {
          code_verifier: saved.code_verifier,
          state: saved.state,
          nonce: saved.nonce
        });

        // Prefer UserInfo (enriched), fallback to claims
        let profile;
        try {
          profile = await client.userinfo(tokenSet.access_token);
        } catch {
          profile = tokenSet.claims();
        }

        const normalized = {
          provider: key,
          sub: profile.sub,
          name: profile.name,
          email: profile.email || profile.preferred_username,
          picture: profile.picture,
          raw: profile
        };

        req.session.user = normalized;
        delete req.session[key];

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><meta charset="utf-8">
<script>
  window.opener && window.opener.postMessage({ type: 'oauth_done', provider: '${key}', ok: true }, '${FRONTEND_ORIGIN}');
  window.close();
</script>`);
      } catch (e) { next(e); }
    };
  }

  // IMPORTANT: paths WITHOUT the extra '/auth' prefix
  router.get('/google', beginAuth(googleClient, {
    scope: 'openid email profile',
    redirect_uri: config.google.redirectUri
  }, 'google'));

  router.get('/google/callback', handleCallback(googleClient, {
    redirect_uri: config.google.redirectUri
  }, 'google'));

  router.get('/microsoft', beginAuth(msClient, {
    scope: 'openid profile email offline_access',
    redirect_uri: config.microsoft.redirectUri
  }, 'microsoft'));

  router.get('/microsoft/callback', handleCallback(msClient, {
    redirect_uri: config.microsoft.redirectUri
  }, 'microsoft'));

  return router;
}

export default createAuthRouter;
