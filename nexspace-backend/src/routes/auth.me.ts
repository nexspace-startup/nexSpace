// src/routes/auth.me.ts
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMe, headSession } from "../controllers/authMe.controller.js";

const router = Router();

router.head("/session", asyncHandler(headSession));
router.get("/me", asyncHandler(getMe));

export default router;
