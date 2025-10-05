import type { Request, Response } from "express";
import { MeetingJoinParams, CreateWorkspaceBody } from "../validators/workspace.validators.js";
import { buildMeetingJoinToken, listWorkspacesForUser } from "../services/meeting.service.js";
import { listMembers } from "../services/workspace.service.js";
import { createWorkspaceForUser, deleteWorkspaceForUser, updateWorkspaceForUser } from "../services/workspace.service.js";

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

export async function createWorkspace(req: Request, res: Response) {
  const userId = req.auth!.userId! as string;

  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }

  try {
    const payload = await createWorkspaceForUser(userId, parsed.data.name);
    return res.success?.(payload, 201) ?? res.status(201).json({ success: true, data: payload, errors: [] });
  } catch (e: any) {
    const code = e?.message;
    if (code === "WORKSPACE_CONFLICT") {
      return res.fail?.([{ message: "WORKSPACE_ALREADY_EXISTS", code: "WORKSPACE_CONFLICT" }], 409);
    }
    return res.fail?.([{ message: "Unable to create workspace", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}

export async function deleteWorkspace(req: Request, res: Response) {
  const userId = req.auth!.userId! as string;

  const parsed = MeetingJoinParams.safeParse(req.params);
  if (!parsed.success) {
    return res.fail?.([{ message: "workspaceUid required", code: "VALIDATION_ERROR" }], 400);
  }

  try {
    const { workspaceUid } = parsed.data as any;
    await deleteWorkspaceForUser(userId, workspaceUid);
    return res.success?.({ id: workspaceUid }, 200) ?? res.status(200).json({ success: true, data: { id: workspaceUid }, errors: [] });
  } catch (e: any) {
    const code = e?.message;
    if (code === "NOT_FOUND")
      return res.fail?.([{ message: "Workspace not found", code: "NOT_FOUND" }], 404);
    if (code === "FORBIDDEN")
      return res.fail?.([{ message: "Forbidden", code: "FORBIDDEN" }], 403);
    return res.fail?.([{ message: "Unable to delete workspace", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}

export async function listWorkspaceMembersCtrl(req: Request, res: Response) {
  const parsed = MeetingJoinParams.safeParse(req.params);
  if (!parsed.success) {
    return res.fail?.([{ message: "workspaceUid required", code: "VALIDATION_ERROR" }], 400);
  }
  const { workspaceUid } = parsed.data as any;
  const q = (req.query?.q as string | undefined) || undefined;
  try {
    const rows = await listMembers(workspaceUid, req.auth!.userId!, q);
    return res.success?.(rows, 200) ?? res.status(200).json({ success: true, data: rows, errors: [] });
  } catch (e: any) {
    const code = e?.message;
    if (code === "WORKSPACE_NOT_FOUND")
      return res.fail?.([{ message: "Workspace not found", code: "NOT_FOUND" }], 404);
    if (code === "FORBIDDEN")
      return res.fail?.([{ message: "Forbidden", code: "FORBIDDEN" }], 403);
    return res.fail?.([{ message: "Unable to list members", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}

export async function updateWorkspace(req: Request, res: Response) {
  const userId = req.auth!.userId! as string;

  const parsedParams = MeetingJoinParams.safeParse(req.params);
  if (!parsedParams.success) {
    return res.fail?.([{ message: "workspaceUid required", code: "VALIDATION_ERROR" }], 400);
  }
  const { workspaceUid } = parsedParams.data as any;

  const parsedBody = CreateWorkspaceBody.safeParse(req.body);
  if (!parsedBody.success) {
    const details = parsedBody.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }

  try {
    const updated = await updateWorkspaceForUser(userId, workspaceUid, parsedBody.data.name);
    return res.success?.(updated, 200) ?? res.status(200).json({ success: true, data: updated, errors: [] });
  } catch (e: any) {
    const code = e?.message;
    if (code === "NOT_FOUND")
      return res.fail?.([{ message: "Workspace not found", code: "NOT_FOUND" }], 404);
    if (code === "FORBIDDEN")
      return res.fail?.([{ message: "Forbidden", code: "FORBIDDEN" }], 403);
    return res.fail?.([{ message: "Unable to update workspace", code: "INTERNAL_SERVER_ERROR" }], 500);
  }
}



