// src/middleware/auth.ts
import type { NextFunction, Request, Response } from "express";
import { DEFAULT_TTL, getSession, type SessionData } from "../session.js";

/**
 * Extract session id from cookies or Authorization header.
 * Supports: Cookie `sid` or header `Authorization: Bearer <sid>`.
 */
function extractSid(req: Request): string | undefined {
  const cookieSid = (req.cookies && (req.cookies as any).sid) as string | undefined;
  if (cookieSid) return cookieSid;
  const auth = req.headers["authorization"] || req.headers["Authorization" as any];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return undefined;
}

/**
 * Attach session to req if present and valid. Does not block anonymous users.
 * Sets `req.auth` when a valid session is found and refreshed.
 */
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const sid = extractSid(req);
    if (!sid) return next();
    const sess = await getSession(sid, DEFAULT_TTL);
    if (!sess) return next();
    req.auth = {
      sid,
      session: sess as SessionData,
      userId: (sess as any)?.userId,
      sub: (sess as any)?.sub,
      email: (sess as any)?.email,
      provider: (sess as any)?.provider,
    };
    return next();
  } catch {
    // Soft-fail and continue as anonymous
    return next();
  }
}

/**
 * Require a valid session. Responds 401 if missing/invalid.
 * Also refreshes TTL (sliding sessions) and sets `req.auth`.
 */
export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const sid = extractSid(req);
  if (!sid) return res.fail?.([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401) ?? res.status(401).end();
  const sess = await getSession(sid, DEFAULT_TTL);
  if (!sess) return res.fail?.([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401) ?? res.status(401).end();
  req.auth = {
    sid,
    session: sess as SessionData,
    userId: (sess as any)?.userId,
    sub: (sess as any)?.sub,
    email: (sess as any)?.email,
    provider: (sess as any)?.provider,
  };
  return next();
}

/**
 * Require a valid session with a DB userId bound.
 * Useful for routes that must know the authenticated user.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  await requireSession(req, res, async () => {
    if (!req.auth?.userId) {
      return res.fail?.([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401) ?? res.status(401).end();
    }
    return next();
  });
}

