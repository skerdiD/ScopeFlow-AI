import type { Request, RequestHandler } from "express";
import { ApiError } from "../middleware/error.middleware.js";
import { editSuggestionsSchema, generateProposalSchema, projectId, sectionSchema, templateDraftSchema } from "../schemas/ai.schemas.js";
import { parseInput } from "../schemas/project.schemas.js";
import { serializeProject } from "../serializers/project.serializer.js";
import { geminiHttpError, GeminiServiceError } from "../services/gemini.service.js";
import { generateProposal, generateTemplate, regenerateSection, reviewQuality, suggestEdits } from "../services/ai-workflow.service.js";
import { normalizeStringList } from "../utils/proposal-content.js";

function user(req: Request) {
  if (!req.authUser) throw new ApiError(401, "Authentication credentials were not provided.");
  if (req.authUser.isDemo) throw new ApiError(403, "This action is disabled in demo mode. Demo users cannot run AI generation.");
  return req.authUser;
}

function handleGemini(error: unknown): never {
  if (error instanceof ApiError) throw error;
  if (error instanceof GeminiServiceError) {
    const response = geminiHttpError(error);
    throw new ApiError(response.status, response.detail);
  }
  throw error;
}

export const generateProposalController: RequestHandler = async (req, res) => {
  const current = user(req);
  const value = (key: string, fallback?: string) => req.body?.[key] ?? (fallback ? req.body?.[fallback] : "") ?? "";
  const candidate = {
    client_name: value("client_name"), business_type: value("business_type", "project_type"),
    project_goals: value("project_goals", "project_name"), required_features: value("required_features", "requirements"),
    budget_range: value("budget_range", "budget"), timeline: value("timeline"), call_notes: value("call_notes"),
    project_name: value("project_name")
  };
  const input = parseInput(generateProposalSchema, candidate);
  input.project_name ||= `${input.client_name} Proposal`;
  try { res.status(201).json(serializeProject(await generateProposal(current, input))); }
  catch (error) { handleGemini(error); }
};

export const regenerateSectionController: RequestHandler = async (req, res) => {
  const current = user(req);
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "section must be one of: scope, deliverables, timeline, pricing, risks, next_steps.");
  try { res.json(serializeProject(await regenerateSection(current, projectId(req.params.id), parsed.data.section, parsed.data.instructions))); }
  catch (error) { handleGemini(error); }
};

export const qualityReviewController: RequestHandler = async (req, res) => {
  const current = user(req);
  try {
    const review = await reviewQuality(current, projectId(req.params.id));
    res.json({
      id: Number(review.id), project: Number(review.projectId), proposal_version: review.proposalVersionId ? Number(review.proposalVersionId) : null,
      score: review.score, summary: review.summary, strengths: review.strengths,
      weaknesses: review.weaknesses, recommendations: review.recommendations,
      created_at: review.createdAt.toISOString()
    });
  } catch (error) { handleGemini(error); }
};

export const editSuggestionsController: RequestHandler = async (req, res) => {
  const current = user(req);
  const parsed = editSuggestionsSchema.safeParse(req.body);
  if (!parsed.success) {
    const sectionValid = typeof req.body?.section === "string" && ["summary", "scope", "deliverables", "timeline", "pricing", "risks", "next_steps"].includes(req.body.section);
    throw new ApiError(400, sectionValid ? "content is required." : "section is invalid.");
  }
  try { res.json(await suggestEdits(current, projectId(req.params.id), parsed.data.section, parsed.data.content)); }
  catch (error) { handleGemini(error); }
};

export const generateTemplateController: RequestHandler = async (req, res) => {
  const current = user(req);
  const parsed = parseInput(templateDraftSchema, req.body);
  const categories = normalizeStringList(parsed.existing_categories);
  try { res.json(await generateTemplate(current, parsed.user_prompt, categories)); }
  catch (error) { handleGemini(error); }
};
