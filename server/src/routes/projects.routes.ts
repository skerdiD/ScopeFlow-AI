import { Router } from "express";
import { exportProjectController } from "../controllers/export.controller.js";
import {
  createProjectController,
  deleteProjectController,
  getProjectController,
  listProjectController,
  markFinalController,
  restoreVersionController,
  shareLinkController,
  updateProjectController
} from "../controllers/projects.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authenticatedRateLimiter } from "../middleware/rate-limit.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const projectsRouter = Router();

projectsRouter.get(["/projects", "/projects/"], requireAuth, authenticatedRateLimiter, asyncHandler(listProjectController));
projectsRouter.post(["/projects", "/projects/"], requireAuth, authenticatedRateLimiter, asyncHandler(createProjectController));
projectsRouter.get(["/projects/:id", "/projects/:id/"], requireAuth, authenticatedRateLimiter, asyncHandler(getProjectController));
projectsRouter.put(["/projects/:id", "/projects/:id/"], requireAuth, authenticatedRateLimiter, asyncHandler(updateProjectController));
projectsRouter.patch(["/projects/:id", "/projects/:id/"], requireAuth, authenticatedRateLimiter, asyncHandler(updateProjectController));
projectsRouter.delete(["/projects/:id", "/projects/:id/"], requireAuth, authenticatedRateLimiter, asyncHandler(deleteProjectController));
projectsRouter.post(
  ["/projects/:id/restore-version", "/projects/:id/restore-version/"],
  requireAuth,
  authenticatedRateLimiter,
  asyncHandler(restoreVersionController)
);
projectsRouter.post(["/projects/:id/mark-final", "/projects/:id/mark-final/"], requireAuth, authenticatedRateLimiter, asyncHandler(markFinalController));
projectsRouter.post(["/projects/:id/share-link", "/projects/:id/share-link/"], requireAuth, authenticatedRateLimiter, asyncHandler(shareLinkController));
projectsRouter.get(["/projects/:id/export", "/projects/:id/export/"], requireAuth, authenticatedRateLimiter, asyncHandler(exportProjectController));
