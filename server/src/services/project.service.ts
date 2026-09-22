import { randomBytes } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error.middleware.js";
import type { ProjectInput, ProjectUpdateInput } from "../schemas/project.schemas.js";
import { buildGeneratedProposalSnapshot, normalizeStringList, SECTION_FIELDS } from "../utils/proposal-content.js";

const detailInclude = {
  versions: { orderBy: { createdAt: "desc" as const } },
  clientComments: { orderBy: { createdAt: "asc" as const } }
};

type Transaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toProjectData(input: ProjectUpdateInput) {
  const data: Prisma.ProposalProjectUpdateInput = {};
  const scalarMap = {
    client_name: "clientName",
    project_name: "projectName",
    project_type: "projectType",
    budget: "budget",
    timeline: "timeline",
    requirements: "requirements",
    summary: "summary",
    scope: "scope",
    deliverables: "deliverables",
    milestones: "milestones",
    proposal_timeline: "proposalTimeline",
    pricing: "pricing",
    risks: "risks",
    next_steps: "nextSteps",
    payment_url: "paymentUrl",
    status: "status"
  } as const;
  for (const [external, internal] of Object.entries(scalarMap)) {
    if (external in input) {
      (data as Record<string, unknown>)[internal] = (input as Record<string, unknown>)[external] ?? "";
    }
  }
  const listMap = {
    missing_information: "missingInformation",
    scope_risks: "scopeRisks",
    unclear_requirements: "unclearRequirements",
    suggested_questions: "suggestedQuestions"
  } as const;
  for (const [external, internal] of Object.entries(listMap)) {
    if (external in input) {
      (data as Record<string, unknown>)[internal] = json((input as Record<string, unknown>)[external] ?? []);
    }
  }
  return data;
}

async function ownedProject(db: Transaction | typeof prisma, projectId: bigint, ownerId: string) {
  const project = await db.proposalProject.findFirst({ where: { id: projectId, userId: ownerId } });
  if (!project) throw new ApiError(404, "Not found.");
  return project;
}

export async function createProjectVersion(
  tx: Transaction,
  project: Awaited<ReturnType<typeof ownedProject>>,
  source: string,
  changedSections: readonly string[],
  isFinal = false
) {
  if (isFinal) {
    const previous = await tx.proposalVersion.findMany({ where: { projectId: project.id, isFinal: true } });
    for (const version of previous) {
      await tx.proposalVersion.update({
        where: { id: version.id },
        data: { isFinal: false, label: version.label === "final" ? `v${version.versionNumber}` : version.label }
      });
    }
  }
  const latest = await tx.proposalVersion.aggregate({ where: { projectId: project.id }, _max: { versionNumber: true } });
  const versionNumber = (latest._max.versionNumber ?? 0) + 1;
  const version = await tx.proposalVersion.create({
    data: {
      projectId: project.id,
      versionNumber,
      label: isFinal ? "final" : `v${versionNumber}`,
      source,
      changedSections: json([...changedSections]),
      summary: project.summary,
      scope: project.scope,
      deliverables: project.deliverables,
      milestones: project.milestones,
      proposalTimeline: project.proposalTimeline,
      pricing: project.pricing,
      risks: project.risks,
      nextSteps: project.nextSteps,
      isFinal,
      createdAt: new Date()
    }
  });
  await tx.proposalProject.update({ where: { id: project.id }, data: { currentVersionId: version.id } });
  return version;
}

export async function listProjects(ownerId: string) {
  return prisma.proposalProject.findMany({ where: { userId: ownerId }, orderBy: { updatedAt: "desc" } });
}

export async function getProject(ownerId: string, projectId: bigint) {
  const project = await prisma.proposalProject.findFirst({
    where: { id: projectId, userId: ownerId },
    include: detailInclude
  });
  if (!project) throw new ApiError(404, "Not found.");
  return project;
}

export async function createProject(ownerId: string, input: ProjectInput, isDemo: boolean) {
  return prisma.$transaction(async (tx) => {
    const data = toProjectData(input);
    const snapshotSource = { ...data } as Record<string, unknown>;
    const project = await tx.proposalProject.create({
      data: {
        ...(data as Prisma.ProposalProjectUncheckedCreateInput),
        userId: ownerId,
        budget: input.budget ?? "",
        timeline: input.timeline ?? "",
        requirements: input.requirements ?? "",
        summary: input.summary ?? "",
        scope: input.scope ?? "",
        deliverables: input.deliverables ?? "",
        milestones: input.milestones ?? "",
        proposalTimeline: input.proposal_timeline ?? "",
        pricing: input.pricing ?? "",
        risks: input.risks ?? "",
        nextSteps: input.next_steps ?? "",
        paymentUrl: input.payment_url ?? "",
        missingInformation: json(input.missing_information ?? []),
        scopeRisks: json(input.scope_risks ?? []),
        unclearRequirements: json(input.unclear_requirements ?? []),
        suggestedQuestions: json(input.suggested_questions ?? []),
        status: input.status ?? "draft",
        shareEnabled: false,
        clientNameResponse: "",
        clientEmailResponse: "",
        clientResponseComment: "",
        isDemo,
        generatedProposal: json(buildGeneratedProposalSnapshot(snapshotSource)),
        createdAt: new Date()
      }
    });
    if (SECTION_FIELDS.some((field) => String(project[field] ?? "").trim())) {
      await createProjectVersion(tx, project, "manual", SECTION_FIELDS);
    }
    return tx.proposalProject.findUniqueOrThrow({ where: { id: project.id }, include: detailInclude });
  });
}

export async function updateProject(ownerId: string, projectId: bigint, input: ProjectUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const before = await ownedProject(tx, projectId, ownerId);
    const updated = await tx.proposalProject.update({ where: { id: before.id }, data: toProjectData(input) });
    const changed = SECTION_FIELDS.filter((field) => before[field] !== updated[field]);
    if (changed.length) await createProjectVersion(tx, updated, "manual", changed);
    await tx.proposalProject.update({
      where: { id: updated.id },
      data: { generatedProposal: json(buildGeneratedProposalSnapshot(updated)) }
    });
    return tx.proposalProject.findUniqueOrThrow({ where: { id: updated.id }, include: detailInclude });
  });
}

export async function deleteProject(ownerId: string, projectId: bigint, isDemoUser: boolean) {
  if (isDemoUser) throw new ApiError(403, "This action is disabled in demo mode. Demo users cannot permanently delete projects.");
  const project = await ownedProject(prisma, projectId, ownerId);
  await prisma.proposalProject.delete({ where: { id: project.id } });
}

export async function restoreVersion(ownerId: string, projectId: bigint, versionId: bigint) {
  return prisma.$transaction(async (tx) => {
    const project = await ownedProject(tx, projectId, ownerId);
    const version = await tx.proposalVersion.findFirst({ where: { id: versionId, projectId: project.id } });
    if (!version) throw new ApiError(404, "Not found.");
    const updated = await tx.proposalProject.update({
      where: { id: project.id },
      data: {
        summary: version.summary, scope: version.scope, deliverables: version.deliverables,
        milestones: version.milestones, proposalTimeline: version.proposalTimeline,
        pricing: version.pricing, risks: version.risks, nextSteps: version.nextSteps,
        currentVersionId: version.id,
        generatedProposal: json(buildGeneratedProposalSnapshot(version))
      }
    });
    return tx.proposalProject.findUniqueOrThrow({ where: { id: updated.id }, include: detailInclude });
  });
}

export async function markFinal(ownerId: string, projectId: bigint, input: ProjectUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const project = await ownedProject(tx, projectId, ownerId);
    const normalized = { ...input };
    for (const key of ["missing_information", "scope_risks", "unclear_requirements", "suggested_questions"] as const) {
      if (key in normalized) normalized[key] = normalizeStringList(normalized[key]);
    }
    const updated = await tx.proposalProject.update({ where: { id: project.id }, data: toProjectData(normalized) });
    await createProjectVersion(tx, updated, "final", SECTION_FIELDS, true);
    await tx.proposalProject.update({
      where: { id: project.id },
      data: { generatedProposal: json(buildGeneratedProposalSnapshot(updated)) }
    });
    return tx.proposalProject.findUniqueOrThrow({ where: { id: project.id }, include: detailInclude });
  });
}

export async function manageShareLink(ownerId: string, projectId: bigint, operation: "generate" | "regenerate" | "disable", isDemoUser: boolean) {
  const project = await ownedProject(prisma, projectId, ownerId);
  if (operation === "disable") {
    await prisma.proposalProject.update({ where: { id: project.id }, data: { shareEnabled: false } });
    return getProject(ownerId, projectId);
  }
  if (project.isDemo || isDemoUser) throw new ApiError(403, "Demo projects cannot create public approval links.");
  await prisma.proposalProject.update({
    where: { id: project.id },
    data: {
      shareToken: operation === "regenerate" || !project.shareToken ? randomBytes(32).toString("base64url") : project.shareToken,
      shareCreatedAt: operation === "regenerate" || !project.shareToken ? new Date() : project.shareCreatedAt,
      shareEnabled: true,
      status: project.status === "draft" ? "sent" : project.status
    }
  });
  return getProject(ownerId, projectId);
}

export { detailInclude };
