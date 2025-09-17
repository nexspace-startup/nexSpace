import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { joinMeeting, listMyWorkspaces, createWorkspace, deleteWorkspace } from "../controllers/workspace.controller.js";
import { createMessage, getMessages, removeMyMessage, adminRemoveAny, eraseMe } from "../controllers/chat.controller.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

// All workspace endpoints require an authenticated user
router.use(asyncHandler(requireUser));

interface workspaceResponse {
  id: string;
  name: string;
}

router.post( "/:workspaceUid/meeting/join", asyncHandler(joinMeeting) );

router.get("/", asyncHandler(listMyWorkspaces));
router.post("/", asyncHandler(createWorkspace));
router.delete("/:workspaceUid", asyncHandler(deleteWorkspace));

// Chat endpoints (persistent)
router.get("/:workspaceUid/chat/messages", asyncHandler(getMessages));
router.post("/:workspaceUid/chat/messages", asyncHandler(createMessage));
router.delete("/:workspaceUid/chat/messages/:messageId", asyncHandler(removeMyMessage));
router.delete("/:workspaceUid/chat/admin/messages/:messageId", asyncHandler(adminRemoveAny));
router.delete("/:workspaceUid/chat/erase/me", asyncHandler(eraseMe));

export default router;
