import type { Request, Response } from "express";
import { DEFAULT_TTL, attachDbUserIdToSession } from "../session.js";
import { loadUserWithMemberships, resolveUserIdBySub, toMeDTO, type MeResponse } from "../services/me.service.js";

export async function headSession(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store");
  // attachSession runs globally; if req.auth exists, session is valid
  return res.status(req.auth?.sid ? 204 : 200).end();
}

export async function getMe(req: Request, res: Response) {
  const sess = req.auth?.session;
  if (!sess) return res.success<MeResponse>({ isAuthenticated: false });
  const sid = req.auth!.sid;
  const sessUserId = req.auth?.userId as string | undefined;
  const sessSub = req.auth?.sub as string | undefined;
  const sessProvider = req.auth?.provider as "google" | "microsoft" | undefined;
  const sessEmail = req.auth?.email as string | undefined;

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

  const dto = toMeDTO(user, sessEmail, sessProvider, (req.auth?.session as any)?.avatar);
  return res.success<MeResponse>(dto);
}
