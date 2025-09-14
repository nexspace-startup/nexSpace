import type { Request, Response } from "express";
import type { z } from "zod";
import { ChatMessageCreateSchema, ChatListQuerySchema, ChatDeleteParams } from "../validators/chat.validators.js";
import { adminDeleteAnyMessage, deleteMyMessage, eraseMyDataInWorkspace, listChatMessages, postMessage } from "../services/chat.service.js";

export async function createMessage(req: Request, res: Response) {
  const params = (req.params || {}) as { workspaceUid: string };
  const parsed = ChatMessageCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i: z.ZodIssue) => ({ path: i.path.join("."), message: i.message }));
    return res.fail?.([{ message: "Validation failed", code: "VALIDATION_ERROR", details }], 400);
  }
  const text = parsed.data.text.trim();
  const uid = params.workspaceUid;
  const userId = req.auth!.userId!;
  const dto = await postMessage(uid, userId, text);
  return res.success?.(dto, 201);
}

export async function getMessages(req: Request, res: Response) {
  const params = (req.params || {}) as { workspaceUid: string };
  const q = ChatListQuerySchema.safeParse(req.query ?? {});
  if (!q.success) return res.fail?.([{ message: "Invalid query", code: "VALIDATION_ERROR" }], 400);
  const dto = await listChatMessages(params.workspaceUid, req.auth!.userId!, q.data.limit, q.data.before);
  return res.success?.(dto, 200);
}

export async function removeMyMessage(req: Request, res: Response) {
  const params = ChatDeleteParams.safeParse(req.params);
  if (!params.success) return res.fail?.([{ message: "Invalid message id", code: "VALIDATION_ERROR" }], 400);
  const { workspaceUid } = req.params as any;
  const count = await deleteMyMessage(workspaceUid, req.auth!.userId!, String(params.data.messageId));
  return res.success?.({ deleted: count > 0 }, count > 0 ? 200 : 404);
}

export async function adminRemoveAny(req: Request, res: Response) {
  const params = ChatDeleteParams.safeParse(req.params);
  if (!params.success) return res.fail?.([{ message: "Invalid message id", code: "VALIDATION_ERROR" }], 400);
  const { workspaceUid } = req.params as any;
  const count = await adminDeleteAnyMessage(workspaceUid, req.auth!.userId!, String(params.data.messageId));
  return res.success?.({ deleted: count > 0 }, count > 0 ? 200 : 404);
}

export async function eraseMe(req: Request, res: Response) {
  const { workspaceUid } = req.params as any;
  const count = await eraseMyDataInWorkspace(workspaceUid, req.auth!.userId!);
  return res.success?.({ erasedMessages: count }, 200);
}

