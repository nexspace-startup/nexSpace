# Nexspace Architecture

This repository is a monorepo with a TypeScript/Express backend and a Vite/React frontend. It integrates Postgres (via Prisma), Redis for sessions/presence caching, LiveKit for real‑time meetings/data, and SendGrid for transactional email.

## Repository Layout

- `package.json` (root): npm workspaces orchestration and dev scripts
- `nexspace-backend/`: Node.js backend (TypeScript → compiled to `dist/`)
- `nexspace-frontend/`: React frontend (Vite)

Root scripts
- `npm run start` — runs frontend and backend concurrently
- `npm run fe` — frontend dev server
- `npm run be` — backend with inspector

## Runtime Overview

- Backend: Express app with layered design
  - Routes (thin) → Controllers (request validation/DTO) → Services (business rules) → Repositories (Prisma DB access)
  - Middlewares for CORS, cookies, session attach/require, response envelope, error handling
  - Sessions stored in Redis with a stateless signed fallback if Redis is unavailable
  - LiveKit integration for meetings, server→room data, and webhooks for presence
  - SendGrid for invitation emails with DB‑backed templates and in‑memory caching
- Frontend: React app using LiveKit client for meetings and a 3D room UI
  - Axios layer pointing to backend, credentials enabled
  - Router guards ensure session is initialized before rendering protected routes

## Backend

Key entrypoints
- `src/server.ts`: Express bootstrap, middleware order, and route mounting
- `src/config/env.ts`: environment configuration
- `src/session.ts`: session lifecycle (Redis + signed‑token fallback)
- `src/middleware/redis.ts`: Redis client/circuit breaker, read/write helpers
- `src/routes/*`: route wiring only
- `src/controllers/*`: input validation and orchestration
- `src/services/*`: business logic (auth, onboarding, meeting, presence, chat)
- `src/repositories/*`: Prisma data access only
- `prisma/schema.prisma`: Postgres schema and indexes

### Middleware & Request Flow

1) LiveKit webhook raw body
- `app.use('/livekit/webhook', livekitWebhook)` is mounted before `express.json()` to preserve the raw body for signature verification.

2) Core middleware
- `express.json()` and `cookie-parser`
- `responseWrapper` adds `res.success(data, status)` and `res.fail(errors, status)` unified envelopes
- `attachSession` loads/refreshes session and exposes `req.auth`
- Minimal CORS is configured from `WEB_ORIGIN`; `Authorization` and credentials are allowed

3) Routes
- Auth/session: `/auth/*`
- Onboarding/invites: `/onboarding`, `/invite`, `/invitations/:token/accept`
- Workspace, chat, presence: `/workspace/*`
- Health: `/health` exposes `{ message: 'ok', redis: boolean }`

4) Errors
- `notFound` 404 and centralized `errorHandler` (both emit the same envelope shape via `res.json`)

### Sessions

Storage
- Primary: Redis keys with optional namespace prefix (`REDIS_PREFIX`)
  - `sess:<sid>` → JSON SessionData
  - `user_sess:<userId>` → Set of sids (index)
  - `sub_sess:<oauth-sub>` → Set of sids (index)
- Fallback: stateless signed token (HMAC SHA‑256 using `SESSION_SECRET`) when Redis is not available

Behavior
- Single active session per identity: creating a session revokes previous sessions for the same `userId`/`sub`
- Sliding TTL: reads can refresh TTL and `lastSeenAt`
- Cookie: `sid` is httpOnly, SameSite=`None` in production (for cross‑origin app), `Lax` in dev

### Redis Client & Cache

- Safe singleton client with exponential reconnect and a simple circuit breaker to avoid hammering Redis
- Namespaced keys via `REDIS_PREFIX`
- JSON helpers: `writeJson`, `readJson`
- Used by sessions and presence caching

### Authentication & Onboarding

- Google OAuth: either One Tap (ID token) or auth code exchange; verified with Google libraries
- Local auth: email + argon2id password (optional pepper), automatic hash upgrades when parameters change
- Onboarding creates/links a user, workspace, membership, and issues session; invitation flows are supported

### LiveKit Integration

- Meeting join: server mints a short‑lived AccessToken bound to user `identity` and workspace room `uid`
- Server‑to‑room data: `sendDataToRoom` publishes JSON payloads (chat, etc.) to all or selected participants
- Webhook receiver: verifies signatures, updates presence on `participant_joined` / `participant_left`

### Presence

- Persistent presence: `UserPresence` rows per user/workspace record online status and last activity
- Cache: Redis key `presence:room:<uid>:identity:<userId>` stores a last‑known snapshot
- LiveKit participant attributes are updated (best‑effort) to reflect the chosen status

### Chat

- Persistent chat per workspace; optional DMs between two users in the same workspace
- Retention: opportunistic purge older than `CHAT_RETENTION_DAYS`
- Optional encryption at rest: set `CHAT_ENC_KEY` (32‑byte) to enable AES‑256‑GCM for message content
- Soft deletion supports user erasure and admin moderation; unread counts tracked via `ChatThreadRead`

### Data Model (Prisma)

Important entities
- `User`, `AuthIdentity`, `UserLogin`
- `Workspace`, `WorkspaceMember`, `Invitation`
- `ChatMessage`, `ChatThreadRead`
- `UserPresence`, `UserStatus`, `UserWorkspaceSession`
- `EmailTemplate`

Indexes are tuned for typical queries (e.g., unread DM counts, workspace membership checks, soft‑deletion scans).

### Response Envelope

All API responses use a consistent shape via `responseWrapper`:
- Success: `{ success: true, data, errors: [] }`
- Error: `{ success: false, data: null, errors: [{ message, code, details? }] }`

Auth‑guarded routes return `401` with `code: "UNAUTHORIZED"` when session is missing/invalid.

### Configuration

Backend environment variables (see `src/config/env.ts`)
- Core: `NODE_ENV`, `PORT`, `WEB_ORIGIN`, `APP_ORIGIN`
- Database: `DATABASE_URL`
- Sessions/Redis: `SESSION_SECRET`, `REDIS_URL`, `REDIS_PREFIX`, `REDIS_BREAKER_*`
- Chat: `CHAT_RETENTION_DAYS`, optional `CHAT_ENC_KEY`
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `MS_*` (if used)
- LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, optional webhook `LIVEKIT_WEBHOOK_API_KEY`/`_SECRET` and `LIVEKIT_WEBHOOK_SKIP_VERIFY`
- Mail: `MAIL_FROM`, `SMTP_*` (optional), `SENDGRID_API_KEY`
- Security: optional `PASSWORD_PEPPER`

### Local Development

- Install dependencies: `npm install`
- Backend: `npm -w nexspace-backend run debug` (or `build` + `start`)
- Frontend: `npm -w nexspace-frontend run dev`
- Combined: `npm run start`
- Database: set `DATABASE_URL` and run Prisma migrations/generate as needed:
  - `npx prisma migrate dev --name <change>`
  - `npx prisma generate`

### Deployment Notes

- Express sets `trust proxy` in production; deploy behind a reverse proxy/ingress
- Ensure cookies are secure in production (HTTPS required for SameSite=None)
- Provision Redis and Postgres; configure LiveKit credentials and webhook
- Configure SendGrid domain/verified sender if using email invites

## Frontend

- React + Vite with router guards around protected routes
- Uses Axios with `withCredentials: true`; backend must allow credentials and set CORS `Access-Control-Allow-Origin`
- LiveKit components for meetings; a 3D room experience is implemented via Three.js components
- Global state via Zustand stores (`userStore`, `workspaceStore`, `meetingStore`)

Key flows
- Session bootstrap: on app load, HEAD `/auth/session` → if 204, GET `/auth/me` to load user/workspaces
- OAuth: FE obtains code or ID token; POST `/auth/google/callback`; server sets httpOnly cookie; FE navigates to dashboard
- Onboarding/Invites: POST `/onboarding`, `/invite`, `/invitations/:token/accept`
- Chat: REST for history and posting; real‑time updates via LiveKit data messages

## Directory Map (high level)

Backend (selected)
- `src/server.ts` — Express bootstrap
- `src/config/env.ts` — env config loader
- `src/middleware/{redis,auth,response,error}.ts`
- `src/session.ts` — session mgmt (Redis + signed fallback)
- `src/routes/*` — routing only
- `src/controllers/*` — HTTP controllers
- `src/services/*` — business logic
- `src/repositories/*` — Prisma access
- `prisma/schema.prisma` — data schema

Frontend (selected)
- `src/App.tsx`, `src/routerGuard.tsx`
- `src/services/{httpService,authService}.ts`
- `src/components/*` (UI, meeting, chat)
- `src/stores/*` (state)

---

This document reflects the current implementation and code structure. If you add new modules/routes, keep the layering (routes → controllers → services → repositories) and response envelope consistent, and prefer Prisma in repositories only.
