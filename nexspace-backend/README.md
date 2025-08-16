# Node Auth Starter (Google + Microsoft, OIDC + PKCE)

Minimal Express scaffold wired for Google and Microsoft sign-in using `openid-client`.

## Quick start

```bash
# 1) Unzip, then inside the folder
npm install

# 2) Create your .env from example
cp .env.example .env
# Fill client IDs/Secrets + redirect URIs

# 3) Run
npm run dev
# Visit http://localhost:3000
```

## Redirect URIs to register (local dev)

- Google:     `http://localhost:3000/auth/google/callback`
- Microsoft:  `http://localhost:3000/auth/microsoft/callback`

## Project structure

```
src/
  auth/
    providers.mjs         # OIDC discovery + clients
  config/
    env.js                # dotenv + config
  middleware/
    requireAuth.mjs
  routes/
    auth.mjs              # /auth/google|microsoft (+ callbacks)
    index.mjs             # home, profile, logout
  server.mjs              # Express bootstrap
.env.example
```

## Notes

- Uses Authorization Code **with PKCE**.
- Session store is in-memory for dev. Use Redis/DB in production.
- For cross-subdomain cookies in prod, set `sameSite: 'none'` and `secure: true`.
- To call provider APIs, request additional scopes and use `tokenSet.access_token`.
