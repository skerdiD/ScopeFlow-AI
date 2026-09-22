import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-test" }
}));
vi.mock("../lib/prisma.js", () => ({
  prisma: { aIPromptVersion: { findFirst: vi.fn().mockResolvedValue(null) } }
}));

import {
  callGeminiJson,
  generateStructuredProposal,
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

  it("retries transient failures with bounded attempts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers(), text: vi.fn().mockResolvedValue("unavailable") })
      .mockResolvedValueOnce({ ok: false, status: 502, headers: new Headers(), text: vi.fn().mockResolvedValue("bad gateway") })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
          usageMetadata: {}
        })
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(callGeminiJson("prompt", 0.2, 100)).resolves.toMatchObject({ data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a successful HTTP response with invalid model output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ candidates: [{ content: { parts: [{ text: "not-json" }] } }] })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(callGeminiJson("prompt", 0.2, 100)).rejects.toThrow("invalid JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("marks malformed proposal output as degraded fallback", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ candidates: [{ content: { parts: [{ text: '{"summary":"incomplete"}' }] } }] })
    }));

    const result = await generateStructuredProposal({
      client_name: "Acme", business_type: "SaaS", project_goals: "Launch",
      required_features: "Auth", budget_range: "$10k", timeline: "6 weeks", call_notes: ""
    });
    expect(result).toMatchObject({ generationSource: "fallback", generationDegraded: true });
    expect(result.data.timeline.length).toBeGreaterThan(0);
    expect(result.data.pricing.length).toBeGreaterThan(0);
    expect(result.data.next_steps.length).toBeGreaterThan(0);
  });
});
