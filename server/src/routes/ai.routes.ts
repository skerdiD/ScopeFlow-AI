import { Router } from "express";
import { migrationPlaceholder } from "../controllers/migration-placeholder.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const aiRouter = Router();

aiRouter.post(["/generate", "/generate/"], requireAuth, migrationPlaceholder("Proposal generation"));
aiRouter.post(["/generate-template", "/generate-template/"], requireAuth, migrationPlaceholder("Template generation"));
aiRouter.post(
  ["/proposals/:id/regenerate-section", "/proposals/:id/regenerate-section/"],
  requireAuth,
  migrationPlaceholder("Section regeneration")
);
aiRouter.post(
  ["/proposals/:id/quality-review", "/proposals/:id/quality-review/"],
  requireAuth,
  migrationPlaceholder("Quality review")
);
aiRouter.post(
  ["/proposals/:id/edit-suggestions", "/proposals/:id/edit-suggestions/"],
  requireAuth,
  migrationPlaceholder("Edit suggestions")
);
