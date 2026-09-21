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
import { asyncHandler } from "../utils/async-handler.js";

export const projectsRouter = Router();

projectsRouter.get(["/projects", "/projects/"], requireAuth, asyncHandler(listProjectController));
projectsRouter.post(["/projects", "/projects/"], requireAuth, asyncHandler(createProjectController));
projectsRouter.get(["/projects/:id", "/projects/:id/"], requireAuth, asyncHandler(getProjectController));
projectsRouter.put(["/projects/:id", "/projects/:id/"], requireAuth, asyncHandler(updateProjectController));
projectsRouter.patch(["/projects/:id", "/projects/:id/"], requireAuth, asyncHandler(updateProjectController));
projectsRouter.delete(["/projects/:id", "/projects/:id/"], requireAuth, asyncHandler(deleteProjectController));
projectsRouter.post(
  ["/projects/:id/restore-version", "/projects/:id/restore-version/"],
  requireAuth,
  asyncHandler(restoreVersionController)
);
projectsRouter.post(["/projects/:id/mark-final", "/projects/:id/mark-final/"], requireAuth, asyncHandler(markFinalController));
projectsRouter.post(["/projects/:id/share-link", "/projects/:id/share-link/"], requireAuth, asyncHandler(shareLinkController));
projectsRouter.get(["/projects/:id/export", "/projects/:id/export/"], requireAuth, asyncHandler(exportProjectController));
