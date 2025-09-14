import type { Request, Response } from "express";
import { MeetingJoinParams } from "../validators/workspace.validators.js";
import { buildMeetingJoinToken, listWorkspacesForUser } from "../services/meeting.service.js";

export async function joinMeeting(req: Request, res: Response) {
  const userId = req.auth!.userId! as string;
  const sess = req.auth!.session;

  const parsed = MeetingJoinParams.safeParse(req.params);
  if (!parsed.success) return res.fail?.([{ message: "workspaceUid required", code: "VALIDATION_ERROR" }], 400);

  try {
    const data = await buildMeetingJoinToken(userId, parsed.data.workspaceUid, sess);
    return res.success?.(data, 200) ?? res.status(200).json({ success: true, data, errors: [] });
  } catch (e: any) {
    const code = e?.message;
    if (code === "LIVEKIT_MISCONFIGURED")
      return res.fail?.([{ message: "LiveKit is not configured", code: "SERVER_MISCONFIGURED" }], 500);
    if (code === "WORKSPACE_NOT_FOUND")
      return res.fail?.([{ message: "Workspace not found", code: "NOT_FOUND" }], 404);
    if (code === "FORBIDDEN")
      return res.fail?.([{ message: "Forbidden", code: "FORBIDDEN" }], 403);
    return res.fail?.([{ message: "Unable to join meeting", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}

export async function listMyWorkspaces(req: Request, res: Response) {
  const userId = req.auth!.userId! as string;

  const rows = await listWorkspacesForUser(userId);
  return res.success?.(rows, 200) ?? res.status(200).json({ success: true, data: rows, errors: [] });
}
