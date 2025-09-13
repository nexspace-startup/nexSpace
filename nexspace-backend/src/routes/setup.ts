import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { onboarding, invite, acceptInvite } from "../controllers/setup.controller.js";
import { requireUser } from "../middleware/auth.js";

const router = Router();

// POST /onboarding
router.post("/onboarding", asyncHandler(onboarding));

// POST /invite
router.post("/invite", asyncHandler(requireUser), asyncHandler(invite));

// POST /invitations/:token/accept
router.post("/invitations/:token/accept", asyncHandler(requireUser), asyncHandler(acceptInvite));

export default router;
