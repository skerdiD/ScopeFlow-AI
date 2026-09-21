import { z } from "zod";
import { ApiError } from "../middleware/error.middleware.js";

const requiredText = (max: number) => z.string().trim().min(1, "This field may not be blank.").max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const longText = z.string().max(8000).optional();
const stringList = z.array(z.unknown()).max(100).superRefine((items, context) => {
  if (items.some((item) => String(item).length > 500)) {
    context.addIssue({ code: "custom", message: "Each item must be at most 500 characters." });
  }
});

const projectFields = {
  client_name: requiredText(255),
  project_name: requiredText(255),
  project_type: requiredText(120),
  budget: optionalText(120),
  timeline: optionalText(120),
  requirements: longText,
  summary: longText,
  scope: longText,
  deliverables: longText,
  milestones: longText,
  proposal_timeline: longText,
  pricing: longText,
  risks: longText,
  next_steps: longText,
  payment_url: z.union([z.literal(""), z.url().max(200)]).optional(),
  missing_information: stringList.optional(),
  scope_risks: stringList.optional(),
  unclear_requirements: stringList.optional(),
  suggested_questions: stringList.optional(),
  status: z.enum(["draft", "sent", "viewed", "approved", "rejected"]).optional()
};

export const createProjectSchema = z.object(projectFields);
export const updateProjectSchema = z.object(projectFields).partial();
export const restoreVersionSchema = z.object({ version_id: z.coerce.bigint() });
export const shareLinkSchema = z.object({
  operation: z.enum(["generate", "regenerate", "disable"]).default("generate")
});

export const publicResponseSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    confirmed: z.boolean().default(false),
    client_name: z.string().trim().max(255).default(""),
    client_email: z.union([z.literal(""), z.email()]).default(""),
    comment: z.string().max(8000).default("")
  })
  .superRefine((value, context) => {
    if (value.status === "approved" && !value.confirmed) {
      context.addIssue({ code: "custom", path: ["confirmed"], message: "Approval confirmation is required." });
    }
  });

export const publicCommentSchema = z
  .object({
    client_name: z.string().trim().max(255).default(""),
    client_email: z.union([z.literal(""), z.email()]).default(""),
    comment: z.string().trim().min(1, "This field may not be blank.").max(8000)
  });

export type ProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectUpdateInput = z.infer<typeof updateProjectSchema>;

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "detail");
    if (!(field in errors)) {
      errors[field] = issue.message;
    }
  }
  throw new ApiError(400, "Invalid request.", errors);
}
