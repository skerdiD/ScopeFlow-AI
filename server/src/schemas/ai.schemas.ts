import { z } from "zod";
import { ApiError } from "../middleware/error.middleware.js";

export const sectionSchema = z.object({
  section: z.enum(["scope", "deliverables", "timeline", "pricing", "risks", "next_steps"]),
  instructions: z.string().trim().default("")
});

export const editSuggestionsSchema = z.object({
  section: z.enum(["summary", "scope", "deliverables", "timeline", "pricing", "risks", "next_steps"]),
  content: z.string().trim().min(1)
});

export const templateDraftSchema = z.object({
  user_prompt: z.string().trim().min(1).max(3000),
  existing_categories: z.array(z.string().trim().min(1).max(120)).max(40).default([])
});

export function projectId(value: string | string[] | undefined): bigint {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) throw new ApiError(404, "Not found.");
  return BigInt(raw);
}
