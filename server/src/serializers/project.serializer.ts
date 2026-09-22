import type { Prisma } from "@prisma/client";

type ProjectWithRelations = Prisma.ProposalProjectGetPayload<{
  include: { versions: true; clientComments: true };
}>;
type ProjectRow = Prisma.ProposalProjectGetPayload<object>;
type VersionRow = Prisma.ProposalVersionGetPayload<object>;
type CommentRow = Prisma.ProposalClientCommentGetPayload<object>;

function id(value: bigint | null): number | null {
  if (value === null) return null;
  const serialized = Number(value);
  if (!Number.isSafeInteger(serialized)) {
    throw new Error("Database id exceeds JavaScript's safe integer range.");
  }
  return serialized;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function serializeVersion(version: VersionRow) {
  return {
    id: id(version.id),
    project: id(version.projectId),
    version_number: version.versionNumber,
    label: version.label,
    source: version.source,
    changed_sections: version.changedSections,
    summary: version.summary,
    scope: version.scope,
    deliverables: version.deliverables,
    milestones: version.milestones,
    proposal_timeline: version.proposalTimeline,
    pricing: version.pricing,
    risks: version.risks,
    next_steps: version.nextSteps,
    generation_source: version.generationSource,
    generation_degraded: version.generationDegraded,
    is_final: version.isFinal,
    created_at: iso(version.createdAt)
  };
}

export function serializeComment(comment: CommentRow) {
  return {
    id: id(comment.id),
    client_name: comment.clientName,
    client_email: comment.clientEmail,
    comment: comment.comment,
    created_at: iso(comment.createdAt)
  };
}

export function serializeProjectListItem(project: ProjectRow) {
  return {
    id: id(project.id),
    user_id: project.userId,
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
    next_steps: project.nextSteps,
    generation_source: project.generationSource,
    generation_degraded: project.generationDegraded,
    payment_url: project.paymentUrl,
    missing_information: project.missingInformation,
    scope_risks: project.scopeRisks,
    unclear_requirements: project.unclearRequirements,
    suggested_questions: project.suggestedQuestions,
    status: project.status,
    created_at: iso(project.createdAt),
    updated_at: iso(project.updatedAt)
  };
}

export function serializeProject(project: ProjectWithRelations) {
  return {
    ...serializeProjectListItem(project),
    generated_proposal: project.generatedProposal,
    current_version_id: id(project.currentVersionId),
    versions: project.versions.map(serializeVersion),
    share_token: project.shareToken,
    share_enabled: project.shareEnabled,
    share_created_at: iso(project.shareCreatedAt),
    share_expires_at: iso(project.shareExpiresAt),
    viewed_at: iso(project.viewedAt),
    client_name_response: project.clientNameResponse,
    client_email_response: project.clientEmailResponse,
    client_response_comment: project.clientResponseComment,
    approved_at: iso(project.approvedAt),
    rejected_at: iso(project.rejectedAt),
    is_demo: project.isDemo,
    client_comments: project.clientComments.map(serializeComment)
  };
}

export function serializePublicProject(project: ProjectWithRelations) {
  const finalVersion = project.versions.find((version) => version.isFinal);
  const source = finalVersion ?? project;
  return {
    project_name: project.projectName,
    client_name: project.clientName,
    project_type: project.projectType,
    budget: project.budget,
    timeline: project.timeline,
    status: project.status,
    payment_url: project.paymentUrl,
    content: {
      summary: source.summary,
      scope: source.scope,
      deliverables: source.deliverables,
      milestones: source.milestones,
      proposal_timeline: source.proposalTimeline,
      pricing: source.pricing,
      risks: source.risks,
      next_steps: source.nextSteps,
      generation_source: source.generationSource,
      generation_degraded: source.generationDegraded,
      source_label: finalVersion?.label ?? "current"
    }
  };
}
