import { Router } from "express";
import {
  publicCommentController,
  publicProposalController,
  publicResponseController
} from "../controllers/public.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const publicRouter = Router();

publicRouter.get(
  ["/public/proposals/:token", "/public/proposals/:token/"],
  asyncHandler(publicProposalController)
);
publicRouter.post(
  ["/public/proposals/:token/response", "/public/proposals/:token/response/"],
  asyncHandler(publicResponseController)
);
publicRouter.post(
  ["/public/proposals/:token/comments", "/public/proposals/:token/comments/"],
  asyncHandler(publicCommentController)
);
