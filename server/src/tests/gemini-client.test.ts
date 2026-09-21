import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-test" }
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { aIPromptVersion: { findFirst: vi.fn().mockResolvedValue(null) } }
}));

import {
  callGeminiJson,
  generateTemplateDraft,
  GeminiApiKeyLeakedError,
  GeminiQuotaExceededError
} from "../services/gemini.service.js";

describe("Gemini HTTP client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps quota responses without exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 429,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "Quota exceeded for metric" } }))
    }));
    await expect(callGeminiJson("prompt", 0.2, 100)).rejects.toBeInstanceOf(GeminiQuotaExceededError);
  });

  it("recognizes blocked leaked keys", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 403,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "Your API key was reported as leaked." } }))
    }));
    await expect(callGeminiJson("prompt", 0.2, 100)).rejects.toBeInstanceOf(GeminiApiKeyLeakedError);
  });

  it("returns a deterministic template fallback when Gemini is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const draft = await generateTemplateDraft("SaaS onboarding", ["SaaS", "Web Design"]);
    expect(draft.category).toBe("SaaS");
    expect(draft.sections.summary.included).toBe(true);
    expect(draft.sections.scope.content).toBeTruthy();
  });
});
