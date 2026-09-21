import { describe, expect, it } from "vitest";
import {
  cleanJsonText,
  GeminiApiResponseError,
  normalizeGeneratedProposal
} from "../services/gemini.service.js";

describe("Gemini structured output", () => {
  it("extracts an object from fenced and wrapped output", () => {
    expect(cleanJsonText('```json\n{"name":"SEO Template","category":"SEO"}\n```\nNotes')).toEqual({
      name: "SEO Template",
      category: "SEO"
    });
  });

  it("normalizes proposal output and bounds item counts", () => {
    const proposal = normalizeGeneratedProposal({
      summary: "Build a polished ecommerce platform for client growth.",
      scope_of_work: ["Discovery", "UX/UI design", "Storefront build", "Checkout flow"],
      deliverables: ["Wireframes", "UI system", "Catalog", "Checkout", "Admin dashboard"],
      milestones: [
        { title: "Discovery", description: "Finalize requirements." },
        { title: "Build", description: "Implement core features." },
        { title: "Launch", description: "QA and deploy." }
      ],
      risks: ["Scope expansion", "Delayed feedback"]
    });
    expect(proposal.scope_of_work).toHaveLength(4);
    expect(proposal.deliverables).toHaveLength(5);
    expect(proposal.milestones).toHaveLength(3);
  });

  it("rejects malformed or incomplete model output", () => {
    expect(() => cleanJsonText("not json")).toThrow(GeminiApiResponseError);
    expect(() => normalizeGeneratedProposal({ summary: "Only a summary" })).toThrow(GeminiApiResponseError);
  });

  it("adds deterministic risk fallbacks when Gemini omits risks", () => {
    const proposal = normalizeGeneratedProposal({
      summary: "Build and launch a focused SaaS product.",
      scope_of_work: ["Discovery", "Design", "Build", "QA"],
      deliverables: ["Plan", "Wireframes", "Application", "QA report", "Handover"],
      milestones: ["Discovery: Confirm scope", "Build: Implement", "Launch: Deploy"],
      risks: []
    }, {
      client_name: "Acme", business_type: "SaaS", project_goals: "Launch",
      required_features: "Auth, billing", budget_range: "$10k", timeline: "2 months", call_notes: ""
    });
    expect(proposal.risks.length).toBeGreaterThanOrEqual(2);
  });
});
