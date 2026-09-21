import { Router } from "express";
import { migrationPlaceholder } from "../controllers/migration-placeholder.controller.js";

export const publicRouter = Router();

publicRouter.get(
  ["/public/proposals/:token", "/public/proposals/:token/"],
  migrationPlaceholder("Public proposal view")
);
publicRouter.post(
  ["/public/proposals/:token/response", "/public/proposals/:token/response/"],
  migrationPlaceholder("Public proposal response")
);
publicRouter.post(
  ["/public/proposals/:token/comments", "/public/proposals/:token/comments/"],
  migrationPlaceholder("Public proposal comments")
);
