import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { expect, it, vi } from "vitest";

const generateProposal = vi.hoisted(() => vi.fn());
vi.mock("../middleware/auth.middleware.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    req.authUser = {
      id: 9, username: "demo-seed-demo", email: "demo@scopeflow.ai",
      supabaseUserId: "remote-demo", isDemo: true
    };
    next();
  }
}));
vi.mock("../services/ai-workflow.service.js", () => ({
  generateProposal,
  regenerateSection: vi.fn(),
  reviewQuality: vi.fn(),
  suggestEdits: vi.fn()
}));

import { createApp } from "../app.js";

it("blocks demo users before any Gemini proposal call", async () => {
  const response = await request(createApp()).post("/api/generate/").send({
    client_name: "Acme", project_goals: "Launch"
  });
  expect(response.status).toBe(403);
  expect(generateProposal).not.toHaveBeenCalled();
});
