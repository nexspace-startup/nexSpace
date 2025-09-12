import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { onboarding, invite, acceptInvite } from "../controllers/setup.controller.js";

const router = Router();

// POST /onboarding
router.post("/onboarding", asyncHandler(onboarding));

// POST /invite
router.post("/invite", asyncHandler(invite));

// POST /invitations/:token/accept
router.post("/invitations/:token/accept", asyncHandler(acceptInvite));

export default router;

