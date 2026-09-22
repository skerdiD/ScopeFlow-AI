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
  getCurrentUsage: vi.fn(),
  generateTemplateDraft: vi.fn(),
  generateProposal: vi.fn(),
  regenerateSection: vi.fn(),
  reviewQuality: vi.fn(),
  suggestEdits: vi.fn(),
  generateTemplate: vi.fn()
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
vi.mock("../services/gemini.service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/gemini.service.js")>()),
  generateTemplateDraft: serviceMocks.generateTemplateDraft
}));
vi.mock("../services/ai-workflow.service.js", () => ({
  generateProposal: serviceMocks.generateProposal,
  regenerateSection: serviceMocks.regenerateSection,
  reviewQuality: serviceMocks.reviewQuality,
  suggestEdits: serviceMocks.suggestEdits,
  generateTemplate: serviceMocks.generateTemplate
}));

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
  generationSource: "gemini",
  generationDegraded: false,
  currentVersionId: 21n,
  status: "draft",
  shareToken: null,
  shareEnabled: false,
  shareCreatedAt: null,
  shareExpiresAt: null,
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
    serviceMocks.generateTemplateDraft.mockResolvedValue({
      name: "SaaS Template",
      description: "For SaaS projects.",
      category: "SaaS",
      sections: {}
    });
    serviceMocks.generateTemplate.mockResolvedValue({
      name: "SaaS Template", description: "For SaaS projects.", category: "SaaS", sections: {}
    });
    serviceMocks.generateProposal.mockResolvedValue(project);
    serviceMocks.regenerateSection.mockResolvedValue(project);
    serviceMocks.reviewQuality.mockResolvedValue({
      id: 30n, projectId: 12n, proposalVersionId: 21n, score: 82,
      summary: "Strong proposal.", strengths: ["Clear scope"], weaknesses: ["Pricing"],
      recommendations: ["Clarify pricing"], createdAt: now
    });
    serviceMocks.suggestEdits.mockResolvedValue({
      summary: "Clear but can improve.", suggestions: [{ type: "clarity", message: "Add specifics." }], improved_example: "Improved."
    });
  });

  it("lists projects using only the authenticated owner", async () => {
    const response = await request(app).get("/api/projects/");
    expect(response.status).toBe(200);
    expect(response.body[0].id).toBe(12);
    expect(serviceMocks.listProjects).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }));
  });

  it("creates a project under the token owner and preserves the API shape", async () => {
    const response = await request(app).post("/api/projects/").send(payload);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 12, user_id: "supabase-owner-id", current_version_id: 21 });
    expect(serviceMocks.createProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, username: "supabase-owner-id" }),
      expect.not.objectContaining({ user_id: expect.anything() }),
      false
    );
  });

  it("retrieves and updates by authenticated owner", async () => {
    expect((await request(app).get("/api/projects/12/")).status).toBe(200);
    expect((await request(app).patch("/api/projects/12/").send({ summary: "Changed" })).status).toBe(200);
    expect(serviceMocks.getProject).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }), 12n);
    expect(serviceMocks.updateProject).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }), 12n, { summary: "Changed" });
  });

  it("deletes with a 204 and owner scope", async () => {
    const response = await request(app).delete("/api/projects/12/");
    expect(response.status).toBe(204);
    expect(serviceMocks.deleteProject).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }), 12n, false);
  });

  it("restores versions and marks final using the existing routes", async () => {
    expect((await request(app).post("/api/projects/12/restore-version/").send({ version_id: 21 })).status).toBe(200);
    expect((await request(app).post("/api/projects/12/mark-final/").send({ summary: "Final" })).status).toBe(200);
    expect(serviceMocks.restoreVersion).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }), 12n, 21n);
    expect(serviceMocks.markFinal).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }), 12n, { summary: "Final" });
  });

  it("returns usage and workspace payloads expected by TanStack Query", async () => {
    const usage = await request(app).get("/api/usage/");
    const workspace = await request(app).get("/api/workspace/");
    expect(usage.body).toMatchObject({ plan: "free", remaining: 2, period: "2026-09" });
    expect(workspace.body.projects).toHaveLength(1);
    expect(workspace.body.usage.used).toBe(1);
  });

  it("returns generated template drafts through the existing contract", async () => {
    const response = await request(app).post("/api/generate-template/").send({ user_prompt: "SaaS template" });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: "SaaS Template", category: "SaaS" });
  });

  it("ports proposal generation and AI review response shapes", async () => {
    const generated = await request(app).post("/api/generate/").send({
      client_name: "Acme", business_type: "SaaS", project_goals: "Improve onboarding",
      required_features: "Auth, analytics", budget_range: "$10k", timeline: "6 weeks", call_notes: ""
    });
    const reviewed = await request(app).post("/api/proposals/12/quality-review/").send({});
    expect(generated.status).toBe(201);
    expect(generated.body.user_id).toBe("supabase-owner-id");
    expect(reviewed.body).toMatchObject({ id: 30, project: 12, proposal_version: 21, score: 82 });
  });

  it("rejects oversized AI input before invoking a Gemini workflow", async () => {
    const generate = await request(app).post("/api/generate/").send({
      client_name: "Acme", business_type: "SaaS", project_goals: "x".repeat(3001),
      required_features: "Auth", budget_range: "$10k", timeline: "6 weeks", call_notes: ""
    });
    const regenerate = await request(app).post("/api/proposals/12/regenerate-section/").send({
      section: "scope", instructions: "x".repeat(3001)
    });
    const suggestions = await request(app).post("/api/proposals/12/edit-suggestions/").send({
      section: "scope", content: "x".repeat(20_001)
    });

    expect([generate.status, regenerate.status, suggestions.status]).toEqual([400, 400, 400]);
    expect(serviceMocks.generateProposal).not.toHaveBeenCalled();
    expect(serviceMocks.regenerateSection).not.toHaveBeenCalled();
    expect(serviceMocks.suggestEdits).not.toHaveBeenCalled();
  });

  it("exports owned projects with download headers", async () => {
    const response = await request(app).get("/api/projects/12/export/?file_type=pdf");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toMatch(/attachment; filename="website-current-\d{8}\.pdf"/);
    expect(serviceMocks.getProject).toHaveBeenCalledWith(expect.objectContaining({ id: 7, username: "supabase-owner-id" }), 12n);
  });

  it("validates export format and final-version selection", async () => {
    expect((await request(app).get("/api/projects/12/export/?file_type=txt")).status).toBe(400);
    const finalResponse = await request(app).get("/api/projects/12/export/?file_type=docx&final_version=true");
    expect(finalResponse.status).toBe(404);
    expect(finalResponse.body.detail).toBe("Final version not found for this project.");
  });
});
