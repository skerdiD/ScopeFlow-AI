import { describe, expect, it } from "vitest";
import { buildExportFilename, buildExportSections, generateDocx, generatePdf } from "../services/export.service.js";

const metadata = {
  projectName: "Acme Website",
  clientName: "Acme",
  projectType: "Web Design",
  budget: "$10,000",
  timeline: "6 weeks",
  sourceLabel: "final"
};
const sections = buildExportSections({
  summary: "A concise proposal.", scope: "- Discovery\n- Build", deliverables: "- Website\n- Handover",
  milestones: "Discovery: Confirm scope\nLaunch: Deploy", proposalTimeline: "- Week 1\n- Week 6",
  pricing: "- Fixed fee", risks: "- Feedback delays", nextSteps: "- Approve proposal"
});

describe("proposal exports", () => {
  it("builds safe dated filenames", () => {
    expect(buildExportFilename("Acme Website!", "Final Client", "pdf")).toMatch(/^acme-website-final-client-\d{8}\.pdf$/);
  });

  it("generates a valid DOCX archive", async () => {
    const output = await generateDocx(metadata, sections);
    expect(output.subarray(0, 2).toString()).toBe("PK");
    expect(output.length).toBeGreaterThan(1000);
  });

  it("generates a valid PDF document", async () => {
    const output = await generatePdf(metadata, sections);
    expect(output.subarray(0, 5).toString()).toBe("%PDF-");
    expect(output.length).toBeGreaterThan(1000);
  });
});
