import type { Request, Response } from "express";
import { DEFAULT_TTL, attachDbUserIdToSession, getSession, isSessionValid } from "../session.js";
import { loadUserWithMemberships, resolveUserIdBySub, toMeDTO, type MeResponse } from "../services/me.service.js";

export async function headSession(req: Request, res: Response) {
  const sid = (req.cookies && (req.cookies as any).sid) as string | undefined;
  res.setHeader("Cache-Control", "no-store");
  if (!sid) return res.status(200).end();
  const ok = await isSessionValid(sid);
  return res.status(ok ? 204 : 200).end();
}

export async function getMe(req: Request, res: Response) {
  const sid = (req.cookies && (req.cookies as any).sid) as string | undefined;
  if (!sid) return res.success<MeResponse>({ isAuthenticated: false });

  const sess = await getSession(sid, DEFAULT_TTL);
  const sessUserId = (sess as any)?.userId as string | undefined;
  const sessSub = (sess as any)?.sub as string | undefined;
  const sessProvider = (sess as any)?.provider as "google" | "microsoft" | undefined;
  const sessEmail = (sess as any)?.email as string | undefined;

  if (!sessUserId && !sessSub) {
    return res.success<MeResponse>({ isAuthenticated: false });
  }

  let user: any = null;
  if (sessUserId) {
    user = await loadUserWithMemberships(sessUserId);
    if (!user) {
      return res.success<MeResponse>({ isAuthenticated: true, user: { id: sessUserId, email: sessEmail }, workspaces: [] });
    }
  }

  if (!user && sessSub) {
    const userIdBn = await resolveUserIdBySub(sessSub, sessProvider);
    if (userIdBn) {
      user = await loadUserWithMemberships(String(userIdBn));
      if (user) {
        await attachDbUserIdToSession(sid, String(user.id), user.first_name ?? "", user.last_name ?? "", DEFAULT_TTL);
      }
    }
  }

  const dto = toMeDTO(user, sessEmail);
  return res.success<MeResponse>(dto);
}

