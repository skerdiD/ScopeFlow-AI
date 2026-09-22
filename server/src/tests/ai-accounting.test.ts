import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  reserveGeneration: vi.fn(),
  releaseGeneration: vi.fn(),
  logAiAction: vi.fn(),
  getProject: vi.fn(),
  suggest: vi.fn(),
  template: vi.fn()
}));

vi.mock("../lib/prisma.js", () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock("../services/usage.service.js", () => ({
  reserveGeneration: mocks.reserveGeneration,
  releaseGeneration: mocks.releaseGeneration,
  logAiAction: mocks.logAiAction
}));
vi.mock("../services/project.service.js", () => ({
  getProject: mocks.getProject,
  createProjectVersion: vi.fn(),
  detailInclude: {}
}));
vi.mock("../services/gemini.service.js", () => ({
  generateEditSuggestions: mocks.suggest,
  generateTemplateDraft: mocks.template,
  generateQualityReview: vi.fn(),
  generateSectionRegeneration: vi.fn(),
  generateStructuredProposal: vi.fn()
}));

import { generateTemplate, suggestEdits } from "../services/ai-workflow.service.js";

const user = { id: 7, username: "owner", email: "owner@example.com", supabaseUserId: "owner", isDemo: false };

describe("AI allowance accounting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reserveGeneration.mockResolvedValue({ consumed: true, status: { remaining: 2 } });
    mocks.getProject.mockResolvedValue({ id: 12n });
    mocks.logAiAction.mockResolvedValue({});
  });

  it("keeps the reservation after a successful expensive AI operation", async () => {
    mocks.suggest.mockResolvedValue({
      output: { summary: "Useful", suggestions: [{ type: "clarity", message: "Be specific" }], improved_example: "Example" },
      tokenUsage: {}, promptVersion: null
    });
    await suggestEdits(user, 12n, "summary", "Current content");
    expect(mocks.reserveGeneration).toHaveBeenCalledWith(7);
    expect(mocks.releaseGeneration).not.toHaveBeenCalled();
  });

  it("releases the reservation when Gemini fails", async () => {
    mocks.suggest.mockRejectedValue(new Error("provider unavailable"));
    await expect(suggestEdits(user, 12n, "summary", "Current content")).rejects.toThrow("provider unavailable");
    expect(mocks.releaseGeneration).toHaveBeenCalledWith(7);
  });

  it("accounts for template generation instead of leaving an unlimited AI path", async () => {
    mocks.template.mockResolvedValue({ name: "Template", description: "Description", category: "Web", sections: {} });
    await generateTemplate(user, "Website proposal", []);
    expect(mocks.reserveGeneration).toHaveBeenCalledWith(7);
    expect(mocks.logAiAction).toHaveBeenCalledWith(expect.objectContaining({ actionType: "template_generation", status: "success" }));
  });
});
