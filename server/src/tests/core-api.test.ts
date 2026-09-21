import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  restoreVersion: vi.fn(),
  markFinal: vi.fn(),
  manageShareLink: vi.fn(),
  getCurrentUsage: vi.fn()
}));

vi.mock("../middleware/auth.middleware.js", () => ({
  requireAuth(req: Request, _res: Response, next: NextFunction) {
    req.authUser = {
      id: 7,
      username: "supabase-owner-id",
      email: "owner@example.com",
      supabaseUserId: "supabase-owner-id",
      isDemo: false
    };
    next();
  }
}));

vi.mock("../services/project.service.js", async () => ({
  ...serviceMocks,
  detailInclude: { versions: true, clientComments: true }
}));
vi.mock("../services/usage.service.js", () => ({ getCurrentUsage: serviceMocks.getCurrentUsage }));

import { createApp } from "../app.js";

const now = new Date("2026-09-01T10:00:00.000Z");
const project = {
  id: 12n,
  userId: "supabase-owner-id",
  clientName: "Acme",
  projectName: "Website",
  projectType: "Web Design",
  budget: "",
  timeline: "",
  requirements: "",
  summary: "Summary",
  scope: "Scope",
  deliverables: "",
  milestones: "",
  proposalTimeline: "",
  pricing: "",
  risks: "",
  nextSteps: "",
  paymentUrl: "",
  missingInformation: [],
  scopeRisks: [],
  unclearRequirements: [],
  suggestedQuestions: [],
  generatedProposal: { summary: "Summary" },
  currentVersionId: 21n,
  status: "draft",
  shareToken: null,
  shareEnabled: false,
  shareCreatedAt: null,
  viewedAt: null,
  clientNameResponse: "",
  clientEmailResponse: "",
  clientResponseComment: "",
  approvedAt: null,
  rejectedAt: null,
  isDemo: false,
  createdAt: now,
  updatedAt: now,
  versions: [],
  clientComments: []
};

const payload = {
  user_id: "attempted-other-owner",
  client_name: "Acme",
  project_name: "Website",
  project_type: "Web Design",
  summary: "Summary"
};

describe("core project API contract", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.listProjects.mockResolvedValue([project]);
    serviceMocks.getProject.mockResolvedValue(project);
    serviceMocks.createProject.mockResolvedValue(project);
    serviceMocks.updateProject.mockResolvedValue(project);
    serviceMocks.restoreVersion.mockResolvedValue(project);
    serviceMocks.markFinal.mockResolvedValue(project);
    serviceMocks.manageShareLink.mockResolvedValue(project);
    serviceMocks.getCurrentUsage.mockResolvedValue({
      plan: "free", used: 1, limit: 3, remaining: 2, is_unlimited: false, period: "2026-09"
    });
  });

  it("lists projects using only the authenticated owner", async () => {
    const response = await request(app).get("/api/projects/");
    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe(12);
    expect(serviceMocks.listProjects).toHaveBeenCalledWith("supabase-owner-id");
  });

  it("creates a project under the token owner and returns the DRF shape", async () => {
    const response = await request(app).post("/api/projects/").send(payload);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 12, user_id: "supabase-owner-id", current_version_id: 21 });
    expect(serviceMocks.createProject).toHaveBeenCalledWith(
      "supabase-owner-id",
      expect.not.objectContaining({ user_id: expect.anything() }),
      false
    );
  });

  it("retrieves and updates by authenticated owner", async () => {
    expect((await request(app).get("/api/projects/12/")).status).toBe(200);
    expect((await request(app).patch("/api/projects/12/").send({ summary: "Changed" })).status).toBe(200);
    expect(serviceMocks.getProject).toHaveBeenCalledWith("supabase-owner-id", 12n);
    expect(serviceMocks.updateProject).toHaveBeenCalledWith("supabase-owner-id", 12n, { summary: "Changed" });
  });

  it("deletes with a 204 and owner scope", async () => {
    const response = await request(app).delete("/api/projects/12/");
    expect(response.status).toBe(204);
    expect(serviceMocks.deleteProject).toHaveBeenCalledWith("supabase-owner-id", 12n, false);
  });

  it("restores versions and marks final using the existing routes", async () => {
    expect((await request(app).post("/api/projects/12/restore-version/").send({ version_id: 21 })).status).toBe(200);
    expect((await request(app).post("/api/projects/12/mark-final/").send({ summary: "Final" })).status).toBe(200);
    expect(serviceMocks.restoreVersion).toHaveBeenCalledWith("supabase-owner-id", 12n, 21n);
    expect(serviceMocks.markFinal).toHaveBeenCalledWith("supabase-owner-id", 12n, { summary: "Final" });
  });

  it("returns usage and workspace payloads expected by TanStack Query", async () => {
    const usage = await request(app).get("/api/usage/");
    const workspace = await request(app).get("/api/workspace/");
    expect(usage.body).toMatchObject({ plan: "free", remaining: 2, period: "2026-09" });
    expect(workspace.body.projects).toHaveLength(1);
    expect(workspace.body.usage.used).toBe(1);
  });

  it("keeps template draft generation authenticated while Gemini remains isolated", async () => {
    const response = await request(app).post("/api/generate-template/").send({ user_prompt: "SaaS template" });
    expect(response.status).toBe(501);
    expect(response.body.detail).toContain("not been ported");
  });
});
