import { z } from "zod";
import { ApiError } from "../middleware/error.middleware.js";

export const sectionSchema = z.object({
  section: z.enum(["scope", "deliverables", "timeline", "pricing", "risks", "next_steps"]),
  instructions: z.string().trim().max(3000).default("")
}).strict();

export const editSuggestionsSchema = z.object({
  section: z.enum(["summary", "scope", "deliverables", "timeline", "pricing", "risks", "next_steps"]),
  content: z.string().trim().min(1).max(20_000)
}).strict();

export const generateProposalSchema = z.object({
  client_name: z.string().trim().min(1).max(255),
  business_type: z.string().trim().max(120).default(""),
  project_goals: z.string().trim().min(1).max(3_000),
  required_features: z.string().trim().max(4_000).default(""),
  budget_range: z.string().trim().max(120).default(""),
  timeline: z.string().trim().max(120).default(""),
  call_notes: z.string().trim().max(4_000).default(""),
  project_name: z.string().trim().max(255).default("")
}).strict();

export const templateDraftSchema = z.object({
  user_prompt: z.string().trim().min(1).max(3000),
  existing_categories: z.array(z.string().trim().min(1).max(120)).max(40).default([])
}).strict();

export function projectId(value: string | string[] | undefined): bigint {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) throw new ApiError(404, "Not found.");
  return BigInt(raw);
}
