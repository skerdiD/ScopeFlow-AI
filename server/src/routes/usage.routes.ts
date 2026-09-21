import { Router } from "express";
import { migrationPlaceholder } from "../controllers/migration-placeholder.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const usageRouter = Router();

usageRouter.get(["/usage", "/usage/"], requireAuth, migrationPlaceholder("Usage status"));
usageRouter.get(["/workspace", "/workspace/"], requireAuth, migrationPlaceholder("Workspace overview"));
