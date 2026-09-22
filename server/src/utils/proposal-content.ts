export const SECTION_FIELDS = [
  "summary",
  "scope",
  "deliverables",
  "milestones",
  "proposalTimeline",
  "pricing",
  "risks",
  "nextSteps"
] as const;

export function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim().replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function parseMilestones(value: unknown): Array<{ title: string; description: string }> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const title = String(record.title ?? "").trim();
      const description = String(record.description ?? "").trim();
      return title && description ? [{ title, description }] : [];
    });
  }
  if (typeof value !== "string") return [];
  return value.split(/\r?\n/).flatMap((line) => {
    const cleaned = line.trim().replace(/^[-*]\s*/, "").trim();
    if (!cleaned) return [];
    const separator = cleaned.indexOf(":");
    const title = (separator >= 0 ? cleaned.slice(0, separator) : cleaned).trim();
    const description = (separator >= 0
      ? cleaned.slice(separator + 1)
      : "Implementation details and delivery checkpoint.").trim();
    return title && description ? [{ title, description }] : [];
  });
}

export function buildGeneratedProposalSnapshot(project: Record<string, unknown>) {
  return {
    summary: String(project.summary ?? ""),
    scope_of_work: normalizeStringList(project.scope),
    deliverables: normalizeStringList(project.deliverables),
    milestones: parseMilestones(project.milestones),
    timeline: normalizeStringList(project.proposalTimeline),
    pricing: normalizeStringList(project.pricing),
    risks: normalizeStringList(project.risks),
    next_steps: normalizeStringList(project.nextSteps),
    generation_source: String(project.generationSource ?? "manual"),
    generation_degraded: Boolean(project.generationDegraded)
  };
}
