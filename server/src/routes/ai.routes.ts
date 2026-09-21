import { Router } from "express";
import {
  editSuggestionsController,
  generateProposalController,
  generateTemplateController,
  qualityReviewController,
  regenerateSectionController
} from "../controllers/ai.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { aiActionLimiter, proposalGenerationLimiter, templateGenerationLimiter } from "../middleware/rate-limit.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

export const aiRouter = Router();

aiRouter.post(["/generate", "/generate/"], requireAuth, proposalGenerationLimiter, asyncHandler(generateProposalController));
aiRouter.post(["/generate-template", "/generate-template/"], requireAuth, templateGenerationLimiter, asyncHandler(generateTemplateController));
aiRouter.post(
  ["/proposals/:id/regenerate-section", "/proposals/:id/regenerate-section/"],
  requireAuth,
  aiActionLimiter,
  asyncHandler(regenerateSectionController)
);
aiRouter.post(
  ["/proposals/:id/quality-review", "/proposals/:id/quality-review/"],
  requireAuth,
  aiActionLimiter,
  asyncHandler(qualityReviewController)
);
aiRouter.post(
  ["/proposals/:id/edit-suggestions", "/proposals/:id/edit-suggestions/"],
  requireAuth,
  aiActionLimiter,
  asyncHandler(editSuggestionsController)
);
