import { Router } from "express";
import { migrationPlaceholder } from "../controllers/migration-placeholder.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const projectsRouter = Router();

projectsRouter.get(["/projects", "/projects/"], requireAuth, migrationPlaceholder("Project listing"));
projectsRouter.post(["/projects", "/projects/"], requireAuth, migrationPlaceholder("Project creation"));
projectsRouter.get(["/projects/:id", "/projects/:id/"], requireAuth, migrationPlaceholder("Project detail"));
projectsRouter.put(["/projects/:id", "/projects/:id/"], requireAuth, migrationPlaceholder("Project update"));
projectsRouter.patch(["/projects/:id", "/projects/:id/"], requireAuth, migrationPlaceholder("Project partial update"));
projectsRouter.delete(["/projects/:id", "/projects/:id/"], requireAuth, migrationPlaceholder("Project deletion"));
projectsRouter.post(
  ["/projects/:id/restore-version", "/projects/:id/restore-version/"],
  requireAuth,
  migrationPlaceholder("Proposal version restore")
);
projectsRouter.post(["/projects/:id/mark-final", "/projects/:id/mark-final/"], requireAuth, migrationPlaceholder("Mark final"));
projectsRouter.post(["/projects/:id/share-link", "/projects/:id/share-link/"], requireAuth, migrationPlaceholder("Share link"));
projectsRouter.get(["/projects/:id/export", "/projects/:id/export/"], requireAuth, migrationPlaceholder("Project export"));
