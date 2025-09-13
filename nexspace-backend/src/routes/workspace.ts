import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { joinMeeting, listMyWorkspaces } from "../controllers/workspace.controller.js";
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

export default router;
