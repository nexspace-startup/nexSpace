// src/routes/google.ts
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { googleCallback, signin } from "../controllers/auth.controller.js";

const router = Router();

// POST /api/auth/google/callback  body: { code, redirectUri: 'postmessage' }
router.post("/google/callback", asyncHandler(googleCallback));

// POST /api/auth/signin
router.post("/signin", asyncHandler(signin));


export default router;
