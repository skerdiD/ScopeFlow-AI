import { Router } from "express";
import { usageController, workspaceController } from "../controllers/usage.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authenticatedRateLimiter } from "../middleware/rate-limit.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const usageRouter = Router();

usageRouter.get(["/usage", "/usage/"], requireAuth, authenticatedRateLimiter, asyncHandler(usageController));
usageRouter.get(["/workspace", "/workspace/"], requireAuth, authenticatedRateLimiter, asyncHandler(workspaceController));
