import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { joinMeeting, listMyWorkspaces } from "../controllers/workspace.controller.js";

const router = Router();

interface workspaceResponse {
  id: string;
  name: string;
}

router.post( "/:workspaceUid/meeting/join", asyncHandler(joinMeeting) );

router.get("/", asyncHandler(listMyWorkspaces));

export default router;
