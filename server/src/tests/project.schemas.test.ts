import { describe, expect, it } from "vitest";
import { createProjectSchema } from "../schemas/project.schemas.js";
import { templateDraftSchema } from "../schemas/ai.schemas.js";

const baseProject = {
  client_name: "Acme",
  project_name: "Website",
  project_type: "Web Design"
};

describe("project string-list validation", () => {
  it.each([
    { missing_information: [{ text: "object" }] },
    { scope_risks: [42] },
    { unclear_requirements: [true] },
    { suggested_questions: [["nested"]] }
  ])("rejects non-string list entries: %j", (invalidField) => {
    expect(createProjectSchema.safeParse({ ...baseProject, ...invalidField }).success).toBe(false);
  });

  it("accepts and trims normal string arrays", () => {
    const result = createProjectSchema.safeParse({
      ...baseProject,
      missing_information: ["  Stakeholder approver  "],
      scope_risks: ["Late feedback"],
      unclear_requirements: ["Analytics vendor"],
      suggested_questions: ["Who approves the scope?"]
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.missing_information).toEqual(["Stakeholder approver"]);
  });

  it("requires template category arrays to contain strings", () => {
    expect(templateDraftSchema.safeParse({ user_prompt: "Create a template", existing_categories: [42] }).success).toBe(false);
    expect(templateDraftSchema.safeParse({ user_prompt: "Create a template", existing_categories: [" SaaS "] })).toMatchObject({
      success: true,
      data: { existing_categories: ["SaaS"] }
    });
  });
});
