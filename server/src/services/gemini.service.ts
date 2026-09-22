import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiServiceError extends Error {}
export class GeminiApiKeyMissingError extends GeminiServiceError {}
export class GeminiApiRequestError extends GeminiServiceError {
  constructor(message: string, readonly retryable = false, readonly retryAfterMs?: number) {
    super(message);
  }
}
export class GeminiApiResponseError extends GeminiServiceError {}
export class GeminiQuotaExceededError extends GeminiApiRequestError {}
export class GeminiApiKeyLeakedError extends GeminiApiRequestError {}

export type TokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

type GeminiResult = { data: Record<string, unknown>; tokenUsage: TokenUsage };
type Intake = Record<"client_name" | "business_type" | "project_goals" | "required_features" | "budget_range" | "timeline" | "call_notes", string>;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5_000;

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers?.get?.("retry-after")?.trim();
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS) : undefined;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function extractFirstObject(value: string): string {
  const start = value.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return value.slice(start, index + 1);
  }
  return "";
}

export function cleanJsonText(rawText: string): Record<string, unknown> {
  const text = rawText.trim();
  if (!text) throw new GeminiApiResponseError("Gemini returned invalid JSON.");
  const candidates = [text];
  if (text.startsWith("```")) {
    const lines = text.split(/\r?\n/);
    if (lines.length >= 3) candidates.push(lines.slice(1, -1).join("\n").trim());
  }
  candidates.push(extractFirstObject(text));
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    const attempts = [candidate, candidate.replace(/^\uFEFF/, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim()];
    for (const attempt of [...new Set(attempts)]) {
      for (const value of [attempt, extractFirstObject(attempt)].filter(Boolean)) {
        try {
          const parsed: unknown = JSON.parse(value);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
          if (Array.isArray(parsed)) {
            const object = parsed.find((item) => item && typeof item === "object" && !Array.isArray(item));
            if (object) return object as Record<string, unknown>;
          }
        } catch { /* try the next candidate */ }
      }
    }
  }
  throw new GeminiApiResponseError("Gemini returned invalid JSON.");
}

async function callGeminiOnce(prompt: string, temperature: number, maxOutputTokens: number): Promise<GeminiResult> {
  if (!env.GEMINI_API_KEY) throw new GeminiApiKeyMissingError("GEMINI_API_KEY is missing.");
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens, responseMimeType: "application/json" }
      }),
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    throw new GeminiApiRequestError("Failed to call Gemini API.", true);
  }
  if (!response.ok) {
    let message = "";
    const rawError = await response.text();
    try {
      const payload = JSON.parse(rawError) as { error?: { message?: string } };
      message = String(payload.error?.message ?? "");
    } catch { message = rawError.slice(0, 500); }
    const normalized = message.toLowerCase();
    if (response.status === 429 || normalized.includes("quota exceeded")) {
      throw new GeminiQuotaExceededError("Gemini quota exceeded for this API project.", true, retryAfterMilliseconds(response));
    }
    if (response.status === 403 && normalized.includes("reported as leaked")) {
      throw new GeminiApiKeyLeakedError("GEMINI_API_KEY has been blocked as leaked.");
    }
    throw new GeminiApiRequestError(
      `Gemini API request failed with status ${response.status}.`,
      RETRYABLE_STATUS.has(response.status),
      retryAfterMilliseconds(response)
    );
  }
  let payload: Record<string, unknown>;
  try { payload = await response.json() as Record<string, unknown>; }
  catch { throw new GeminiApiResponseError("Gemini API response was not valid JSON."); }
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  let responseText = "";
  for (const candidate of candidates) {
    const content = (candidate as { content?: { parts?: Array<{ text?: unknown }> } }).content;
    const joined = (content?.parts ?? []).map((part) => String(part.text ?? "")).join("\n").trim();
    if (joined) { responseText = joined; break; }
  }
  if (!responseText) throw new GeminiApiResponseError("Gemini returned an empty response.");
  const usage = (payload.usageMetadata ?? {}) as Record<string, unknown>;
  const token = (value: unknown) => typeof value === "number" && value >= 0 ? value : undefined;
  return {
    data: cleanJsonText(responseText),
    tokenUsage: {
      input_tokens: token(usage.promptTokenCount),
      output_tokens: token(usage.candidatesTokenCount),
      total_tokens: token(usage.totalTokenCount)
    }
  };
}

export async function callGeminiJson(prompt: string, temperature: number, maxOutputTokens: number): Promise<GeminiResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await callGeminiOnce(prompt, temperature, maxOutputTokens);
    } catch (error) {
      lastError = error;
      if (!(error instanceof GeminiApiRequestError) || !error.retryable || attempt === MAX_ATTEMPTS - 1) throw error;
      const backoff = error.retryAfterMs ?? RETRY_DELAY_MS * (2 ** attempt);
      await wait(Math.min(backoff, MAX_RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

function truncateWords(value: string, maximum: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length <= maximum ? words.join(" ") : `${words.slice(0, maximum).join(" ").replace(/[ ,;:]+$/, "")}.`;
}

function stringList(value: unknown, maxWords: number): string[] {
  const raw = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(/\r?\n/) : [];
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    const clean = item.trim().replace(/^[-*]\s*/, "");
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return [];
    seen.add(key);
    return [truncateWords(clean, maxWords)];
  });
}

function milestones(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  const output: Array<{ title: string; description: string }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let title = "";
    let description = "";
    if (item && typeof item === "object") {
      title = String((item as Record<string, unknown>).title ?? "").trim();
      description = String((item as Record<string, unknown>).description ?? "").trim();
    } else {
      const text = String(item).trim().replace(/^[-*]\s*/, "");
      const split = text.indexOf(":");
      title = (split >= 0 ? text.slice(0, split) : text).trim();
      description = (split >= 0 ? text.slice(split + 1) : "Implementation details and delivery checkpoint.").trim();
    }
    const key = `${title.toLowerCase()}|${description.toLowerCase()}`;
    if (title && description && !seen.has(key)) {
      seen.add(key);
      output.push({ title: truncateWords(title, 8), description: truncateWords(description, 22) });
    }
  }
  return output;
}

function requireCount<T>(items: T[], min: number, max: number, field: string): T[] {
  if (items.length < min) throw new GeminiApiResponseError(`Gemini returned too few items for ${field}. Expected at least ${min}.`);
  return items.slice(0, max);
}

function fallbackRisks(intake: Intake): string[] {
  const values = [
    "Scope expansion beyond the agreed feature list can affect budget and delivery dates.",
    "Delayed stakeholder feedback can push milestone approvals and final launch timing.",
    "Unclear requirements for key workflows may cause rework during implementation.",
    "Third-party tools or API dependencies may introduce delays outside project control."
  ];
  if (["2 week", "3 week", "1 month", "2 month"].some((token) => intake.timeline.toLowerCase().includes(token))) {
    values[1] = "A compressed timeline may require phased delivery to protect release quality.";
  }
  if (!intake.required_features.trim()) values[2] = "If core requirements stay broad, scope decisions may take longer and impact delivery.";
  return values;
}

export type GeneratedProposal = {
  summary: string;
  scope_of_work: string[];
  deliverables: string[];
  milestones: Array<{ title: string; description: string }>;
  timeline: string[];
  pricing: string[];
  risks: string[];
  next_steps: string[];
};

const generatedProposalSchema = z.object({
  summary: z.string().trim().min(1).max(4_000),
  scope_of_work: z.array(z.string().trim().min(1).max(600)).min(4).max(8),
  deliverables: z.array(z.string().trim().min(1).max(600)).min(5).max(8),
  milestones: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(600)
  })).min(3).max(5),
  timeline: z.array(z.string().trim().min(1).max(600)).min(1).max(8),
  pricing: z.array(z.string().trim().min(1).max(600)).min(1).max(8),
  risks: z.array(z.string().trim().min(1).max(600)).min(2).max(4),
  next_steps: z.array(z.string().trim().min(1).max(600)).min(1).max(6)
}).strict();

export function normalizeGeneratedProposal(data: Record<string, unknown>, intake?: Intake): GeneratedProposal {
  void intake;
  const parsed = generatedProposalSchema.safeParse(data);
  if (!parsed.success) throw new GeminiApiResponseError("Gemini returned an invalid proposal structure.");
  return {
    summary: truncateWords(parsed.data.summary.replace(/\s+/g, " "), 80),
    scope_of_work: parsed.data.scope_of_work.map((item) => truncateWords(item, 18)),
    deliverables: parsed.data.deliverables.map((item) => truncateWords(item, 16)),
    milestones: parsed.data.milestones.map((item) => ({ title: truncateWords(item.title, 8), description: truncateWords(item.description, 22) })),
    timeline: parsed.data.timeline.map((item) => truncateWords(item, 20)),
    pricing: parsed.data.pricing.map((item) => truncateWords(item, 24)),
    risks: parsed.data.risks.map((item) => truncateWords(item, 18)),
    next_steps: parsed.data.next_steps.map((item) => truncateWords(item, 18))
  };
}

function fallbackProposal(intake: Intake): GeneratedProposal {
  const features = intake.required_features.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  while (features.length < 3) features.push(["core workflow implementation", "responsive user experience", "launch readiness"][features.length]);
  return {
    summary: truncateWords(`We will deliver a ${intake.business_type || "digital"} project for ${intake.client_name || "the client"} focused on ${intake.project_goals || "clear business outcomes"}. Delivery will be phased over approximately ${intake.timeline || "6-10 weeks"} with regular review checkpoints.`, 75),
    scope_of_work: ["Discovery and technical planning aligned to project goals", ...features.map((item) => `Implement ${item}`), "Quality assurance, revisions, and launch readiness"].slice(0, 8),
    deliverables: ["Project execution plan with agreed scope boundaries", ...features.map((item) => `Completed implementation of ${item}`), "QA report and launch handover package"].slice(0, 8),
    milestones: [
      { title: "Discovery", description: "Confirm scope, priorities, and delivery sequence." },
      { title: "Execution", description: "Build and review core features in iterative checkpoints." },
      { title: "Validation", description: "Complete QA, revisions, and acceptance preparation." },
      { title: "Launch", description: "Release the project and provide handover documentation." }
    ],
    timeline: [intake.timeline ? `Target delivery: ${intake.timeline}` : "Delivery timing will be confirmed during kickoff.", "Review checkpoints will follow each major milestone."],
    pricing: [intake.budget_range ? `Estimated budget: ${intake.budget_range}` : "Pricing will be confirmed after scope approval.", "Payment schedule will be agreed before work begins."],
    risks: fallbackRisks(intake),
    next_steps: ["Review and approve the proposed scope.", "Confirm the project owner and decision makers.", "Schedule the project kickoff."]
  };
}

function proposalPrompt(intake: Intake): string {
  const shape = { summary: "string", scope_of_work: ["string"], deliverables: ["string"], milestones: [{ title: "string", description: "string" }], timeline: ["string"], pricing: ["string"], risks: ["string"], next_steps: ["string"] };
  return `You are a senior digital agency strategist writing a proposal for ${intake.client_name || "the client"}.
Rewrite rough intake notes into a concise, client-ready proposal.
Write like a sharp freelancer or agency lead: practical, clear, and commercially aware.
The result should feel 20-35% shorter than typical AI consultancy output while keeping useful detail.

Return valid JSON only. No markdown. No code fences. No commentary.

Required JSON shape:
${JSON.stringify(shape)}

Content rules:
- summary:
  - Exactly one short paragraph.
  - State what will be built, expected outcome, and timeline context.
  - Keep it tight and client-facing. No inflated strategy language.
- scope_of_work:
  - 4 to 8 items.
  - Each item should be a concrete workstream.
  - Keep bullets concise and specific to provided requirements.
- deliverables:
  - 5 to 8 realistic outputs the client will actually receive.
  - Keep deliverables tangible and client-facing.
  - Avoid generic boilerplate that could fit any project.
- milestones:
  - 3 to 5 milestones in logical sequence from discovery to launch/handover.
  - Titles must be short and actionable.
  - Descriptions should be brief and outcome-focused.
- timeline:
  - 1 to 8 concise phase or timing statements grounded in the supplied timeline.
- pricing:
  - 1 to 8 concise commercial statements grounded in the supplied budget; do not invent exact prices.
- risks:
  - 2 to 4 practical risks/assumptions.
  - Keep each risk concise and specific to likely delivery constraints.
  - Typical risk themes: scope expansion, delayed feedback, unclear requirements, third-party dependency delays.
  - Never return an empty risks list.
- next_steps:
  - 1 to 6 specific actions needed to approve and start the work.

Writing quality rules:
- Use modern, direct business language.
- Keep sentences short to medium length and easy to scan.
- Avoid repetitive phrases and generic filler.
- Avoid buzzword-heavy claims and empty qualifiers.
- Do not use phrases like: "robust foundation", "accelerate your market entry", "operational stability post-launch", "comprehensive professional proposal draft".
- If input is rough, improve clarity while preserving intent.
- Do not invent constraints, integrations, or legal commitments that were not implied by the intake.
- Keep wording concise, believable, and tailored to this project.
- Do not repeat the same idea across sections.

Project intake:
- Client name: ${intake.client_name || "the client"}
- Business type: ${intake.business_type}
- Project goals: ${intake.project_goals}
- Required features: ${intake.required_features}
- Budget range: ${intake.budget_range}
- Timeline: ${intake.timeline}
- Call notes: ${intake.call_notes}

Grounding hints:
- If budget or timeline is provided, reflect realistic prioritization and phasing.
- If required features are listed, map scope and deliverables directly to those features.
- If call notes are sparse, infer sensible professional wording but stay conservative.`;
}

async function activePrompt(purpose: string) {
  return prisma.aIPromptVersion.findFirst({ where: { purpose, isActive: true }, orderBy: { updatedAt: "desc" } });
}

function render(template: string, context: Record<string, unknown>) {
  return Object.entries(context).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

export async function generateStructuredProposal(intake: Intake) {
  const promptVersion = await activePrompt("full_proposal");
  const prompt = promptVersion ? render(promptVersion.promptText, { ...intake, intake_json: JSON.stringify(intake) }) : proposalPrompt(intake);
  try {
    const result = await callGeminiJson(prompt, 0.2, 900);
    return { data: normalizeGeneratedProposal(result.data, intake), tokenUsage: result.tokenUsage, promptVersion, generationSource: "gemini" as const, generationDegraded: false };
  } catch (error) {
    if (!(error instanceof GeminiApiResponseError)) throw error;
    console.warn("Gemini proposal output failed validation; using deterministic fallback.");
    return { data: fallbackProposal(intake), tokenUsage: {}, promptVersion, generationSource: "fallback" as const, generationDegraded: true };
  }
}

const sectionPrompt = `You are improving one section of a client proposal. Return valid JSON only with this shape: {"content":"string"}. Rewrite only the requested section using concise, professional, client-facing language.\nSection: {section}\nCustom instructions: {instructions}\nProject context JSON:\n{project_json}`;
const reviewPrompt = `You are a senior proposal reviewer. Return valid JSON only with this shape: {"score":82,"summary":"string","strengths":["string"],"weaknesses":["string"],"recommendations":["string"]}. Score from 0 to 100 based on clarity, specificity, scope control, commercial confidence, and client readiness.\nProposal JSON:\n{project_json}`;
const editPrompt = `You are a senior editor reviewing a user-edited proposal section. Return valid JSON only with this shape: {"summary":"string","suggestions":[{"type":"clarity","message":"string"}],"improved_example":"string"}. Do not be generic. Suggest practical improvements without changing the user's intent.\nSection: {section}\nContent:\n{content}`;

async function purposePrompt(purpose: string, fallback: string) {
  const promptVersion = await activePrompt(purpose);
  return { promptVersion, text: promptVersion?.promptText ?? fallback };
}

export async function generateSectionRegeneration(context: Record<string, unknown>, section: string, instructions = "") {
  const { promptVersion, text } = await purposePrompt("section_regeneration", sectionPrompt);
  const result = await callGeminiJson(render(text, { section, instructions: instructions || "Improve clarity and client readiness.", project_json: JSON.stringify(context) }), 0.25, 700);
  const parsed = z.object({ content: z.string().trim().min(1).max(12_000) }).strict().safeParse(result.data);
  if (!parsed.success) throw new GeminiApiResponseError("Gemini returned an invalid regenerated section.");
  return { content: parsed.data.content, tokenUsage: result.tokenUsage, promptVersion };
}

export async function generateQualityReview(context: Record<string, unknown>) {
  const { promptVersion, text } = await purposePrompt("quality_review", reviewPrompt);
  const result = await callGeminiJson(render(text, { project_json: JSON.stringify(context) }), 0.2, 900);
  const parsed = z.object({
    score: z.number().int().min(0).max(100),
    summary: z.string().trim().min(1).max(2_000),
    strengths: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
    weaknesses: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
    recommendations: z.array(z.string().trim().min(1).max(500)).min(1).max(6)
  }).strict().safeParse(result.data);
  if (!parsed.success) throw new GeminiApiResponseError("Gemini returned an invalid quality review.");
  const review = {
    score: parsed.data.score,
    summary: truncateWords(parsed.data.summary, 45),
    strengths: parsed.data.strengths.map((item) => truncateWords(item, 18)),
    weaknesses: parsed.data.weaknesses.map((item) => truncateWords(item, 18)),
    recommendations: parsed.data.recommendations.map((item) => truncateWords(item, 18))
  };
  return { review, tokenUsage: result.tokenUsage, promptVersion };
}

export async function generateEditSuggestions(section: string, content: string) {
  const { promptVersion, text } = await purposePrompt("edit_suggestions", editPrompt);
  const result = await callGeminiJson(render(text, { section, content }), 0.25, 800);
  const parsed = z.object({
    summary: z.string().trim().min(1).max(2_000),
    suggestions: z.array(z.object({ type: z.string().trim().min(1).max(80), message: z.string().trim().min(1).max(600) }).strict()).min(1).max(6),
    improved_example: z.string().trim().min(1).max(12_000)
  }).strict().safeParse(result.data);
  if (!parsed.success) throw new GeminiApiResponseError("Gemini returned incomplete edit suggestions.");
  const output = { ...parsed.data, summary: truncateWords(parsed.data.summary, 35) };
  return { output, tokenUsage: result.tokenUsage, promptVersion };
}

const templateSections = ["summary", "scope", "deliverables", "milestones", "timeline", "assumptions", "risks"] as const;
const templateSectionSchema = z.object({
  included: z.boolean(),
  content: z.string().trim().max(8_000)
}).strict();
const templateResponseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1_000),
  category: z.string().trim().min(1).max(120),
  sections: z.object({
    summary: templateSectionSchema,
    scope: templateSectionSchema,
    deliverables: templateSectionSchema,
    milestones: templateSectionSchema,
    timeline: templateSectionSchema,
    assumptions: templateSectionSchema,
    risks: templateSectionSchema
  }).strict()
}).strict();
function templateFallback(userPrompt: string, categories: string[]) {
  const lower = userPrompt.toLowerCase();
  const archetype = lower.match(/saas|mvp|startup/) ? "SaaS" : lower.match(/shop|store|e-?commerce/) ? "E-commerce" : lower.match(/dashboard|internal/) ? "Internal Tools" : lower.match(/marketing|campaign/) ? "Marketing" : "Web Design";
  const category = categories.find((item) => item.toLowerCase() === archetype.toLowerCase()) ?? archetype;
  const name = `${truncateWords(userPrompt.replace(/[^a-z0-9 ]/gi, " "), 4) || archetype} Template`;
  const defaults: Record<(typeof templateSections)[number], string> = {
    summary: `Deliver a focused ${userPrompt} project with clear outcomes and a practical delivery plan.`,
    scope: "- Discovery and requirement alignment\n- Solution planning and design\n- Core implementation\n- QA and launch readiness",
    deliverables: "- Scope and execution plan\n- Approved design direction\n- Implemented core deliverables\n- QA summary\n- Final handover package",
    milestones: "Discovery and direction confirmation\nBuild and review cycle\nTesting and refinement\nLaunch and handover",
    timeline: "6-10 weeks",
    assumptions: "Stakeholders provide timely feedback and required assets.",
    risks: "Late requirement changes may affect timeline and effort."
  };
  return {
    name, description: `For ${userPrompt.toLowerCase()} projects that need clear scope, milestones, and handover.`, category,
    sections: Object.fromEntries(templateSections.map((key) => [key, { included: !["assumptions", "risks"].includes(key), content: defaults[key] }]))
  };
}

export async function generateTemplateDraft(userPrompt: string, categories: string[]) {
  const fallback = templateFallback(userPrompt, categories);
  const shape = {
    name: "string", description: "string", category: "string",
    sections: Object.fromEntries(templateSections.map((key) => [key, { included: "boolean", content: "string" }]))
  };
  const categoryHint = categories.slice(0, 12).join(", ");
  const categoryRule = categoryHint ? `Prefer one of these exact categories when it fits: ${categoryHint}.` : "Choose a concise category name.";
  const sparsePrompt = userPrompt.trim().split(/\s+/).length >= 5
    ? userPrompt.trim()
    : `${userPrompt.trim()}. Use a ${fallback.category} template style with concrete scope, deliverables, milestones, and a realistic timeline.`;
  const prompt = `You are a senior proposal strategist creating reusable proposal templates.
Transform the short user prompt into a polished template draft with practical default content.
Write with the same concise and realistic tone used in modern agency proposal templates.

Return valid JSON only. No markdown. No code fences. No commentary.

Required JSON shape:
${JSON.stringify(shape)}

Rules:
- name: 2 to 5 words; should read like a reusable template title; include "Proposal" only when natural.
- description: one specific, concise sentence explaining when this template should be used.
- category: short and clear project type. ${categoryRule}
- sections.summary: included must be true; one concise paragraph describing project intent and outcome.
- sections.scope: included must be true; 4 to 6 concrete workstream bullets using "- " prefixes.
- sections.deliverables: included must be true; 4 to 6 tangible output bullets using "- " prefixes.
- sections.milestones: included must be true; 3 to 5 short, unnumbered lines in execution order.
- sections.timeline: included must be true; short duration text such as "6-8 weeks".
- sections.assumptions: include only when useful; if included, one concise sentence.
- sections.risks: include when useful; if included, one concise sentence.

Style constraints:
- Keep content practical and believable.
- Avoid vague buzzwords and generic filler.
- Do not invent legal/compliance guarantees.
- Keep each section ready for real proposal use without heavy editing.
- Do not copy the user prompt verbatim into section content.
- If the user prompt is short or vague, infer a plausible professional template and add concrete details.
- Never output placeholders like "I don't know", "something", "TBD", or "etc".

User prompt:
${sparsePrompt}`;
  let parsed: z.infer<typeof templateResponseSchema> | null = null;
  try {
    const result = await callGeminiJson(prompt, 0.4, 1200);
    const validation = templateResponseSchema.safeParse(result.data);
    if (validation.success) parsed = validation.data;
    else console.warn("Gemini template output failed validation; using deterministic fallback.");
  } catch (error) {
    if (!(error instanceof GeminiServiceError)) throw error;
    console.warn("Gemini template generation failed; using deterministic fallback.");
  }
  if (!parsed) return fallback;
  return {
    name: truncateWords(parsed.name, 5),
    description: parsed.description,
    category: parsed.category,
    sections: parsed.sections
  };
}

export function geminiHttpError(error: unknown) {
  if (error instanceof GeminiQuotaExceededError) return { status: 429, detail: "AI generation is temporarily unavailable due to usage limits." };
  if (error instanceof GeminiApiKeyMissingError || error instanceof GeminiApiKeyLeakedError) return { status: 500, detail: "AI generation is temporarily unavailable." };
  return { status: 502, detail: "AI generation failed. Please try again later." };
}
