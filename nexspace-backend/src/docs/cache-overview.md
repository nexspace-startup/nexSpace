# Redis caching overview

This document summarises the server-side caches that were introduced around the Redis helper, what data each cache holds, the invalidation strategy, and the reasoning behind the configured TTLs.

## Shared primitives and fallback behaviour

All cache consumers rely on the helper functions in `src/utils/cache.ts`. Key factories (`CacheKeys`) keep the namespace consistent and prevent key collisions, while `withCache` implements the common "read-through" pattern: it attempts to read from Redis first, and if the value is missing it loads from Prisma, stores the fresh payload, and returns it to the caller.【F:src/utils/cache.ts†L3-L45】 TTLs are expressed in seconds in the `CacheTTL` map and passed to Redis via the helper so they are automatically applied whenever a value is written.【F:src/utils/cache.ts†L13-L42】

When Redis is unavailable the middleware functions short-circuit to `null`/no-ops instead of throwing. The client uses a circuit breaker to avoid repeatedly attempting connections during outages and provides reconnect/back-off logic so Prisma queries still serve as the source of truth.【F:src/middleware/redis.ts†L14-L239】 That behaviour gives every cached path a graceful fallback: cache lookups return `null`, causing the corresponding database query to execute instead.

## Workspace lookups

| Key | Loader | TTL | Notes |
| --- | --- | --- | --- |
| `workspace:{uid}` | `prisma.workspace.findUnique` (UID + name) | 5 minutes | Workspace metadata changes infrequently, so a 5 minute cache smooths repeated navigation without letting stale names linger for long.【F:src/repositories/workspace.repository.ts†L6-L12】【F:src/utils/cache.ts†L13-L18】 |
| `workspace:{uid}:member:{userId}` | `prisma.workspaceMember.findFirst` (role) | 3 minutes | Membership checks are on the hot path for authz, so caching the role reduces repeated lookups, while a shorter TTL allows permission changes to propagate quickly.【F:src/repositories/workspace.repository.ts†L14-L23】【F:src/utils/cache.ts†L13-L17】 |
| `workspace:{uid}:members` | `prisma.workspaceMember.findMany` (listing) | 3 minutes (queryless requests only) | Full member rosters are reused across the UI. The TTL balances responsiveness with staleness; query-filtered lookups bypass the cache entirely to stay real-time.【F:src/repositories/workspace.repository.ts†L48-L94】【F:src/utils/cache.ts†L13-L17】 |

Workspace creation, updates, deletions, and invitation acceptance call `setCache`/`invalidateCache` to prime or clear the above entries so that the cached state aligns with the database.【F:src/services/workspace.service.ts†L1-L90】【F:src/services/setup.service.ts†L16-L118】【F:src/services/setup.service.ts†L200-L233】

## User profile aggregation

| Key | Loader | TTL | Notes |
| --- | --- | --- | --- |
| `user:{id}:profile` | `prisma.user.findUnique` (user + memberships) | 5 minutes | Hydrating the "Me" payload hits several tables. Caching the result for 5 minutes removes redundant joins for dashboard refreshes while keeping profile edits responsive.【F:src/repositories/user.repository.ts†L30-L133】【F:src/utils/cache.ts†L13-L18】 |
| `user:{id}:workspaces` | `prisma.workspaceMember.findMany` (role + workspace summary) | 3 minutes | The workspace switcher and onboarding flows query this frequently; a shorter TTL makes membership churn visible quickly.【F:src/repositories/workspace.repository.ts†L25-L46】【F:src/utils/cache.ts†L13-L19】 |

User- and workspace-level cache entries are invalidated whenever onboarding, workspace CRUD, or invitation flows mutate related data, ensuring cache coherence.【F:src/services/setup.service.ts†L16-L118】【F:src/services/workspace.service.ts†L20-L90】

## Authentication identities

| Key | Loader | TTL | Notes |
| --- | --- | --- | --- |
| `auth:identity:{provider}:{providerId}` | `prisma.authIdentity.findUnique` (userId) | 10 minutes | OAuth lookups depend on provider webhooks and change rarely. A longer TTL limits redundant round trips during rapid login retries while still expiring within a short session window.【F:src/repositories/auth.repository.ts†L1-L19】【F:src/utils/cache.ts†L13-L20】 |

## Presence snapshots

Presence writes use Redis as a best-effort edge cache for LiveKit and database state. Each participant update stores `{ status, ts }` at `presence:room:{uid}:identity:{userId}` without a TTL so that "last seen" timestamps persist between reconnects until superseded by fresh activity.【F:src/services/presence.service.ts†L12-L155】 The consumer (`getPresenceSnapshot`) bulk-reads those keys and falls back to Prisma for any missing identities, seeding Redis afterwards. Database state therefore remains the source of truth if the cache entry has expired or Redis is unavailable.【F:src/services/presence.service.ts†L98-L158】

## Summary of TTL rationale

* **5 minutes (300s)** for entities whose shape rarely changes (`workspace`, `user profile`). The window is long enough to benefit navigation flows but short enough that edits surface within a single refresh cycle.【F:src/utils/cache.ts†L13-L18】
* **3 minutes (180s)** for membership-related collections and authorisation checks where role churn needs to be visible quickly, trading a modest cache hit window for freshness.【F:src/utils/cache.ts†L13-L18】
* **10 minutes (600s)** for authentication identities because the mapping from provider sub ➝ userId is stable, and caching it across multiple login attempts avoids repeated Prisma hits.【F:src/utils/cache.ts†L13-L20】
* **No TTL** for presence snapshots because the values already carry timestamps and are actively refreshed whenever a user connects, disconnects, or updates their status; missing entries trigger a database read and rehydration, so persistence until overwrite keeps "last known" data available without manual eviction.【F:src/services/presence.service.ts†L33-L158】

Together these caches reduce repeated database work on the hottest read paths, while the invalidation hooks and Redis failover logic keep the system correct even when cache entries are stale or Redis is offline.