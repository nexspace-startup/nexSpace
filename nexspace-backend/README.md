# Nexspace Backend – Layered Architecture

TypeScript + Express + Prisma backend, refactored to a clean layered architecture with clear separation of concerns.

## Folder layout

```
src/
  config/                 # env.ts (dotenv + config)
  controllers/            # Express controllers: validate -> call service -> respond
    auth.controller.ts
    authMe.controller.ts
    setup.controller.ts
    workspace.controller.ts
  middleware/             # error, redis, response wrapper, etc.
  repositories/           # Prisma-only data access
    auth.repository.ts
    user.repository.ts
    workspace.repository.ts
  routes/                 # endpoint wiring only
    auth.me.ts
    setup.ts
    signin.ts
    workspace.ts
  services/               # business logic only
    auth.service.ts
    me.service.ts
    meeting.service.ts
    setup.service.ts
  validators/             # Zod schemas
    authValidators.ts
    setup.validators.ts
    workspace.validators.ts
  prisma.ts               # Prisma client
  server.ts               # Express bootstrap
  session.ts              # Session management (Redis)
```

## Sessions – single active session per identity

Sessions are stored in Redis and indexed by both DB `userId` and OAuth `sub`:

- Creating a session (`createSession`) now revokes any existing sessions for the same `userId` or `sub` before creating a new one.
- Attaching a DB user id (`attachDbUserIdToSession`) revokes any other sessions for that `userId`, keeping only the current SID.
- Rotating a session (`rotateSession`) updates both user and sub indices atomically.
- Helpers include `revokeSession`, `revokeAllSessions(userId)`, and `revokeAllSessionsBySub(sub)`.

This guarantees a single active session per identity, whether the user came via local sign-in or OAuth-first.

## Auth Middleware

- `attachSession` (global): Parses `sid` from cookie or `Authorization: Bearer <sid>`, loads the session with sliding TTL, and attaches it to `req.auth` when present. This runs globally in `server.ts` so downstream handlers can read `req.auth` if needed.
- `requireSession`: Ensures a valid session exists; responds `401` with a unified JSON error if missing/invalid. Also sets `req.auth`.
- `requireUser`: Like `requireSession`, but additionally enforces that the session is bound to a DB `userId`.

Usage examples:

```
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

// Protect all routes in this router
router.use(asyncHandler(requireUser));

router.get('/protected', asyncHandler(async (req, res) => {
  const userId = req.auth!.userId!;
  // ...
  return res.success({ ok: true });
}));
```

Notes:
- Session id is read from the `sid` cookie by default; an `Authorization: Bearer <sid>` header also works (CORS includes `Authorization`).
- All protected responses use the same `res.fail([{ message: 'Unauthorized', code: 'UNAUTHORIZED' }], 401)` shape.

## Build

```
cd nexspace-backend
npm install
npm run build
```

## Environment

See `src/config/env.ts` for required variables: Postgres `DATABASE_URL`, Redis `REDIS_URL`, and LiveKit `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`. `WEB_ORIGIN` is used for CORS and invite URLs.

## Persistent Chat

- Storage: `ChatMessage` table linked to `Workspace` and `User` (Prisma model).
- Endpoints (all require auth and workspace membership):
  - `GET /workspace/:workspaceUid/chat/messages?limit=50&before=ms` — paginated history (ascending).
  - `POST /workspace/:workspaceUid/chat/messages` — body `{ text }`; stores message and returns DTO.
  - `DELETE /workspace/:workspaceUid/chat/messages/:messageId` — sender can soft‑delete own message (GDPR erasure-friendly).
  - `DELETE /workspace/:workspaceUid/chat/admin/messages/:messageId` — OWNER/ADMIN can soft‑delete any message in workspace.
  - `DELETE /workspace/:workspaceUid/chat/erase/me` — soft‑delete all of current user’s messages in the workspace (Right to Erasure).
- Retention: Controlled by `CHAT_RETENTION_DAYS` (default 30). Older messages are opportunistically purged on new writes to minimize data retention.
- Encryption at rest (optional): Set `CHAT_ENC_KEY` to a 32‑byte key (hex or base64/base64url). Messages are transparently AES‑256‑GCM encrypted in the DB and decrypted on read. If key is not set or invalid, plaintext is stored.

Security & GDPR notes
- Access control: All chat routes require a valid session and membership in the target workspace. Admin endpoints additionally enforce OWNER/ADMIN role.
- Data minimization: Only store `workspaceId`, `senderId`, `roomUid`, `content`, and timestamps. No IP addresses or device identifiers are recorded.
- Erasure: Soft‑delete replaces `content` with empty string and sets `deletedAt`. Use retention to hard‑purge older records.
- Portability: History endpoint provides exportable JSON; extend as needed for user export tooling.
- Defaults: CORS already permits `Authorization` and credentials; cookies remain httpOnly.

Migration
- After altering `prisma/schema.prisma`, run:
  - `npx prisma migrate dev --name add_chat_messages` in development, then `prisma migrate deploy` in production.
  - Or `npx prisma generate` to refresh the client after schema changes.
