import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { joinMeeting, listMyWorkspaces, createWorkspace, deleteWorkspace, listWorkspaceMembersCtrl, updateWorkspace } from "../controllers/workspace.controller.js";
import { createMessage, getMessages, removeMyMessage, adminRemoveAny, eraseMe, getDMThreads, markThreadReadCtrl } from "../controllers/chat.controller.js";
import { requireUser } from "../middleware/auth.js";
import { setPresence } from "../controllers/presence.controller.js";

const router = Router();

// All workspace endpoints require an authenticated user
router.use(asyncHandler(requireUser));

interface workspaceResponse {
  id: string;
  name: string;
}

router.post("/:workspaceUid/meeting/join", asyncHandler(joinMeeting));

router.get("/", asyncHandler(listMyWorkspaces));
router.post("/", asyncHandler(createWorkspace));
router.delete("/:workspaceUid", asyncHandler(deleteWorkspace));
router.get("/:workspaceUid/members", asyncHandler(listWorkspaceMembersCtrl));
router.put("/:workspaceUid", updateWorkspace);

// Chat endpoints (persistent)
router.get("/:workspaceUid/chat/messages", asyncHandler(getMessages));
router.post("/:workspaceUid/chat/messages", asyncHandler(createMessage));
router.delete("/:workspaceUid/chat/messages/:messageId", asyncHandler(removeMyMessage));
router.delete("/:workspaceUid/chat/admin/messages/:messageId", asyncHandler(adminRemoveAny));
router.delete("/:workspaceUid/chat/erase/me", asyncHandler(eraseMe));
router.get("/:workspaceUid/chat/threads", asyncHandler(getDMThreads));
router.post("/:workspaceUid/chat/threads/:peerId/read", asyncHandler(markThreadReadCtrl));

// Presence endpoints
router.post("/:workspaceUid/presence", asyncHandler(setPresence));

export default router;
