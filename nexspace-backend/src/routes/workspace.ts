import { Router, type Request, type Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { prisma } from "../prisma.js";
import { getSession, DEFAULT_TTL } from "../session.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { config } from "../config/env.js";
import z from "zod";

const router = Router();

interface workspaceResponse {
  id: string;
  name: string;
}

const LIVEKIT_URL = config.liveKit.url;
const LIVEKIT_API_KEY = config.liveKit.apiKey;
const LIVEKIT_API_SECRET = config.liveKit.apiSecret;

router.post(
  "/:workspaceUid/meeting/join",
  asyncHandler(async (req: Request, res: Response) => {
    // --- Basic env validation
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return res.fail?.(
        [{ message: "LiveKit is not configured", code: "SERVER_MISCONFIGURED" }],
        500
      ) ?? res.status(500).json({ success: false, errors: [{ message: "LiveKit is not configured", code: "SERVER_MISCONFIGURED" }] });
    }

    // --- AuthN
    const sid = req.cookies?.sid as string | undefined;
    if (!sid) {
      return res.fail?.(
        [{ message: "Unauthorized", code: "UNAUTHORIZED" }],
        401
      ) ?? res.status(401).json({ success: false, errors: [{ message: "Unauthorized", code: "UNAUTHORIZED" }] });
    }

    const sess = await getSession(sid, DEFAULT_TTL);
    const userId = sess?.userId;
    if (!userId) {
      return res.fail?.(
        [{ message: "Unauthorized", code: "UNAUTHORIZED" }],
        401
      ) ?? res.status(401).json({ success: false, errors: [{ message: "Unauthorized", code: "UNAUTHORIZED" }] });
    }

    // --- Params
    const Params = z.object({ workspaceUid: z.string().regex(/^\d+$/, 'workspaceUid must be numeric') });
    const parsedParams = Params.safeParse(req.params);
    if (!parsedParams.success) {
      return res.fail?.(
        [{ message: "workspaceUid required", code: "VALIDATION_ERROR" }],
        400
      ) ?? res.status(400).json({ success: false, errors: [{ message: "workspaceUid required", code: "VALIDATION_ERROR" }] });
    }
    const workspaceUid = parsedParams.data.workspaceUid;

    // --- Resolve workspace
    const ws = await prisma.workspace.findUnique({
      where: { id: BigInt(workspaceUid) },
      select: { id: true, uid: true, name: true },
    });
    if (!ws) {
      return res.fail?.(
        [{ message: "Workspace not found", code: "NOT_FOUND" }],
        404
      ) ?? res.status(404).json({ success: false, errors: [{ message: "Workspace not found", code: "NOT_FOUND" }] });
    }

    // --- Membership check (AuthZ)
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: BigInt(userId) } },
      select: { role: true }, // assuming you have status; remove if not
    });

    if (!member) {
      return res.fail?.(
        [{ message: "Forbidden", code: "FORBIDDEN" }],
        403
      ) ?? res.status(403).json({ success: false, errors: [{ message: "Forbidden", code: "FORBIDDEN" }] });
    }

    // Optional: tighten who can join (customize to your model).
    // Example: disallow suspended/invited-only roles.
    // Adjust these to your actual enums if different.
    if ((member as any)?.status === "SUSPENDED") {
      return res.fail?.(
        [{ message: "Account suspended for this workspace", code: "FORBIDDEN" }],
        403
      ) ?? res.status(403).json({ success: false, errors: [{ message: "Account suspended for this workspace", code: "FORBIDDEN" }] });
    }

    // --- Build identity & display name
    const identity = String(userId); // must be unique in room
    const displayName =
      [sess?.firstName, sess?.lastName].filter(Boolean).join(" ") ||
      (sess as any)?.email ||
      `user-${identity}`;
    // --- Issue LiveKit token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName,
      ttl: "2h",
    });

    at.addGrant({
      room: ws.uid,            // room name = workspace UID
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      // roomAdmin: false, roomCreate: false (Cloud autostarts)
    });

    const token = await at.toJwt(); // v2 async

    // --- Response (matches your frontend expectations)
    return res.success?.(
      { url: LIVEKIT_URL, token, identity, room: ws.uid },
      200
    ) ?? res.status(200).json({ success: true, data: { url: LIVEKIT_URL, token, identity, room: ws.uid }, errors: [] });
  })
);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const sid = req.cookies?.sid as string | undefined;
    if (!sid) return res.fail([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401);
    const sess = await getSession(sid, DEFAULT_TTL);
    const userId = sess?.userId;
    if (!userId) return res.fail([{ message: "Unauthorized", code: "UNAUTHORIZED" }], 401);
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: BigInt(userId) } } },
      select: { id: true, name: true },
    });
    const responseData: workspaceResponse[] = workspaces.map(ws => ({ id: String(ws.id), name: ws.name }));
    return res.success(responseData);
  })
);

export default router;
