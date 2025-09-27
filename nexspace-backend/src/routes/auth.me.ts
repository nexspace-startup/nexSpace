// src/routes/auth.me.ts
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getMe, headSession } from "../controllers/authMe.controller.js";
import { searchUsers } from "../controllers/auth.controller.js";

const router = Router();

router.head("/session", asyncHandler(headSession));
router.get("/me", asyncHandler(getMe));
router.get("/searchAll", asyncHandler(searchUsers))

export default router;
