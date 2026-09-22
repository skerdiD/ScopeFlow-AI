import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.middleware.js";
import { buildGeneratedProposalSnapshot, SECTION_FIELDS } from "../utils/proposal-content.js";
import {
  generateEditSuggestions,
  generateQualityReview,
  generateSectionRegeneration,
  generateStructuredProposal,
  generateTemplateDraft,
  type GeneratedProposal
} from "./gemini.service.js";
import { createProjectVersion, detailInclude, getProject } from "./project.service.js";
import { logAiAction, releaseGeneration, reserveGeneration } from "./usage.service.js";

const AI_SECTION_TO_FIELD = {
  scope: "scope",
  deliverables: "deliverables",
  timeline: "proposalTimeline",
  pricing: "pricing",
  risks: "risks",
  next_steps: "nextSteps"
} as const;

export type GenerateInput = {
  client_name: string;
  business_type: string;
  project_goals: string;
  required_features: string;
  budget_range: string;
  timeline: string;
  call_notes: string;
  project_name: string;
};

function generatedFields(generated: GeneratedProposal) {
  return {
    summary: generated.summary,
    scope: generated.scope_of_work.map((item) => `- ${item}`).join("\n"),
    deliverables: generated.deliverables.map((item) => `- ${item}`).join("\n"),
    milestones: generated.milestones.map((item) => `${item.title}: ${item.description}`).join("\n"),
    proposalTimeline: generated.timeline.map((item) => `- ${item}`).join("\n"),
    pricing: generated.pricing.map((item) => `- ${item}`).join("\n"),
    risks: generated.risks.map((item) => `- ${item}`).join("\n"),
    nextSteps: generated.next_steps.map((item) => `- ${item}`).join("\n"),
    generatedProposal: generated as unknown as Prisma.InputJsonValue
  };
}

async function reserveOrThrow(userId: number) {
  const reservation = await reserveGeneration(userId);
  if (!reservation.consumed) throw new ApiError(429, "Generation limit reached.", {
    detail: "You have reached your monthly AI generation limit. Upgrade to run more AI actions.",
    usage: reservation.status
  });
  return reservation;
}

function context(project: Awaited<ReturnType<typeof getProject>>) {
  return {
    client_name: project.clientName,
    project_name: project.projectName,
    project_type: project.projectType,
    budget: project.budget,
    timeline: project.timeline,
    requirements: project.requirements,
    summary: project.summary,
    scope: project.scope,
    deliverables: project.deliverables,
    milestones: project.milestones,
    proposal_timeline: project.proposalTimeline,
    pricing: project.pricing,
    risks: project.risks,
    next_steps: project.nextSteps
  };
}

function validatedContext(project: Awaited<ReturnType<typeof getProject>>) {
  const value = context(project);
  if (JSON.stringify(value).length > 30_000) {
    throw new ApiError(400, "Proposal content exceeds the 30000 character limit for AI actions.");
  }
  return value;
}

export async function generateProposal(user: Express.AuthenticatedUser, input: GenerateInput) {
  await reserveOrThrow(user.id);
  const intake = {
    client_name: input.client_name,
    business_type: input.business_type,
    project_goals: input.project_goals,
    required_features: input.required_features,
    budget_range: input.budget_range,
    timeline: input.timeline,
    call_notes: input.call_notes
  };
  let result: Awaited<ReturnType<typeof generateStructuredProposal>>;
  try { result = await generateStructuredProposal(intake); }
  catch (error) {
    await releaseGeneration(user.id);
    await logAiAction({ userId: user.id, actionType: "full_proposal_generation", status: "failure", errorMessage: String(error) });
    throw error;
  }
  const outcome = await prisma.$transaction(async (tx) => {
    const requirements = [
      `Project goals: ${input.project_goals}`,
      input.required_features ? `Required features: ${input.required_features}` : "",
      input.call_notes ? `Call notes: ${input.call_notes}` : ""
    ].filter(Boolean).join("\n");
    const project = await tx.proposalProject.create({
      data: {
        ownerId: user.id,
        userId: user.username,
        clientName: input.client_name,
        projectName: input.project_name,
        projectType: input.business_type,
        budget: input.budget_range,
        timeline: input.timeline,
        requirements,
        status: "draft",
        paymentUrl: "",
        missingInformation: [],
        scopeRisks: [],
        unclearRequirements: [],
        suggestedQuestions: [],
        shareEnabled: false,
        clientNameResponse: "",
        clientEmailResponse: "",
        clientResponseComment: "",
        isDemo: false,
        createdAt: new Date(),
        generationSource: result.generationSource,
        generationDegraded: result.generationDegraded,
        ...generatedFields(result.data)
      }
    });
    await createProjectVersion(tx, project, "generate", SECTION_FIELDS);
    await logAiAction({
      userId: user.id, projectId: project.id, actionType: "full_proposal_generation", status: "success",
      promptVersionId: result.promptVersion?.id, tokenUsage: result.tokenUsage
    }, tx);
    return tx.proposalProject.findUniqueOrThrow({ where: { id: project.id }, include: detailInclude });
  });
  return outcome;
}

export async function regenerateSection(user: Express.AuthenticatedUser, projectId: bigint, section: keyof typeof AI_SECTION_TO_FIELD, instructions: string) {
  const project = await getProject(user, projectId);
  await reserveOrThrow(user.id);
  const field = AI_SECTION_TO_FIELD[section];
  let result: Awaited<ReturnType<typeof generateSectionRegeneration>>;
  try { result = await generateSectionRegeneration(validatedContext(project), section, instructions); }
  catch (error) {
    await releaseGeneration(user.id);
    await logAiAction({ userId: user.id, projectId, actionType: "section_regeneration", status: "failure", errorMessage: String(error) });
    throw error;
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.proposalProject.update({
      where: { id: project.id },
      data: { [field]: result.content, generationSource: "gemini", generationDegraded: false }
    });
    await tx.proposalProject.update({
      where: { id: project.id },
      data: { generatedProposal: buildGeneratedProposalSnapshot(updated) as Prisma.InputJsonValue }
    });
    await createProjectVersion(tx, updated, "regenerate", [field]);
    await logAiAction({
      userId: user.id, projectId, actionType: "section_regeneration", status: "success",
      promptVersionId: result.promptVersion?.id, tokenUsage: result.tokenUsage
    }, tx);
    return tx.proposalProject.findUniqueOrThrow({ where: { id: project.id }, include: detailInclude });
  });
}

export async function reviewQuality(user: Express.AuthenticatedUser, projectId: bigint) {
  const project = await getProject(user, projectId);
  await reserveOrThrow(user.id);
  let result: Awaited<ReturnType<typeof generateQualityReview>>;
  try { result = await generateQualityReview(validatedContext(project)); }
  catch (error) {
    await releaseGeneration(user.id);
    await logAiAction({ userId: user.id, projectId, actionType: "quality_score", status: "failure", errorMessage: String(error) });
    throw error;
  }
  return prisma.$transaction(async (tx) => {
    const review = await tx.aIQualityReview.create({
      data: {
        projectId, userId: user.id, proposalVersionId: project.currentVersionId,
        promptVersionId: result.promptVersion?.id,
        score: result.review.score, summary: result.review.summary,
        strengths: result.review.strengths, weaknesses: result.review.weaknesses,
        recommendations: result.review.recommendations,
        createdAt: new Date()
      }
    });
    await logAiAction({
      userId: user.id, projectId, actionType: "quality_score", status: "success",
      promptVersionId: result.promptVersion?.id, tokenUsage: result.tokenUsage
    }, tx);
    return review;
  });
}

export async function generateTemplate(user: Express.AuthenticatedUser, prompt: string, categories: string[]) {
  await reserveOrThrow(user.id);
  try {
    const output = await generateTemplateDraft(prompt, categories);
    await logAiAction({ userId: user.id, actionType: "template_generation", status: "success" });
    return output;
  } catch (error) {
    await releaseGeneration(user.id);
    await logAiAction({ userId: user.id, actionType: "template_generation", status: "failure", errorMessage: String(error) });
    throw error;
  }
}

export async function suggestEdits(user: Express.AuthenticatedUser, projectId: bigint, section: string, content: string) {
  await getProject(user, projectId);
  await reserveOrThrow(user.id);
  try {
    const result = await generateEditSuggestions(section, content);
    await logAiAction({
      userId: user.id, projectId, actionType: "edit_suggestions", status: "success",
      promptVersionId: result.promptVersion?.id, tokenUsage: result.tokenUsage
    });
    return result.output;
  } catch (error) {
    await releaseGeneration(user.id);
    await logAiAction({ userId: user.id, projectId, actionType: "edit_suggestions", status: "failure", errorMessage: String(error) });
    throw error;
  }
}
