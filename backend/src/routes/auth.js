import { generators } from 'openid-client';
import { getClients } from '../auth/providers.js';
import { config } from '../config/env.js';

function beginAuth(client, { scope, redirect_uri }, key) {
  return async (req, res, next) => {
    try {
      const code_verifier  = generators.codeVerifier();
      const code_challenge = generators.codeChallenge(code_verifier);
      const state          = generators.state();

      req.session[key] = { code_verifier, state };

      const url = client.authorizationUrl({
        scope,
        redirect_uri,
        code_challenge,
        code_challenge_method: 'S256',
        state
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
        state: saved.state
      });

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
      res.redirect('/profile');
    } catch (e) { next(e); }
  };
}

export function registerAuthRoutes(app) {
  const { googleClient, msClient } = getClients();

  app.get('/auth/google', beginAuth(googleClient, {
    scope: 'openid email profile',
    redirect_uri: config.google.redirectUri
  }, 'google'));

  app.get('/auth/google/callback', handleCallback(googleClient, {
    redirect_uri: config.google.redirectUri
  }, 'google'));

  app.get('/auth/microsoft', beginAuth(msClient, {
    scope: 'openid profile email offline_access',
    redirect_uri: config.microsoft.redirectUri
  }, 'microsoft'));

  app.get('/auth/microsoft/callback', handleCallback(msClient, {
    redirect_uri: config.microsoft.redirectUri
  }, 'microsoft'));
}
