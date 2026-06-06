import type { TemplateDraftInput } from "@/lib/templates";
import { supabase } from "@/lib/supabase";

const LOCAL_API_BASE_URL = "http://127.0.0.1:8000/api";
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE_URL = (configuredApiBaseUrl || (import.meta.env.DEV ? LOCAL_API_BASE_URL : "")).replace(/\/+$/, "");

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "API is not configured. Set VITE_API_BASE_URL to your backend URL (example: https://scopeflow-ai.onrender.com/api)."
    );
  }

  if (!import.meta.env.DEV && /https?:\/\/(localhost|127\.0\.0\.1)/i.test(API_BASE_URL)) {
    throw new Error(
      "VITE_API_BASE_URL points to localhost in production. Set it to your deployed backend URL."
    );
  }

  return API_BASE_URL;
}

export type GeneratedMilestone = {
  title: string;
  description: string;
};

export type GeneratedProposalContent = {
  summary: string;
  scope_of_work: string[];
  deliverables: string[];
  milestones: GeneratedMilestone[];
  risks: string[];
};

export type ProposalVersion = {
  id: number;
  project: number;
  version_number: number;
  label: string;
  source: string;
  changed_sections: string[];
  summary: string;
  scope: string;
  deliverables: string;
  milestones: string;
  proposal_timeline: string;
  pricing: string;
  risks: string;
  next_steps: string;
  is_final: boolean;
  created_at: string;
};

export type ProposalProject = {
  id: number;
  user_id: string;
  client_name: string;
  project_name: string;
  project_type: string;
  budget: string;
  timeline: string;
  requirements: string;
  summary: string;
  scope: string;
  deliverables: string;
  milestones: string;
  proposal_timeline: string;
  pricing: string;
  risks: string;
  next_steps: string;
  payment_url: string;
  missing_information: string[];
  scope_risks: string[];
  unclear_requirements: string[];
  suggested_questions: string[];
  generated_proposal: GeneratedProposalContent | null;
  current_version_id: number | null;
  versions: ProposalVersion[];
  status: string;
  share_token: string | null;
  share_enabled: boolean;
  share_created_at: string | null;
  viewed_at: string | null;
  client_name_response: string;
  client_email_response: string;
  client_response_comment: string;
  approved_at: string | null;
  rejected_at: string | null;
  is_demo: boolean;
  client_comments: ProposalClientComment[];
  created_at: string;
  updated_at: string;
};

export type ProposalProjectListItem = Omit<
  ProposalProject,
  "generated_proposal" | "current_version_id" | "versions" | "share_token" | "share_enabled" | "share_created_at" | "viewed_at" | "client_name_response" | "client_email_response" | "client_response_comment" | "approved_at" | "rejected_at" | "is_demo" | "client_comments"
>;

export type ProposalClientComment = {
  id: number;
  client_name: string;
  client_email: string;
  comment: string;
  created_at: string;
};

export type PublicProposal = {
  project_name: string;
  client_name: string;
  project_type: string;
  budget: string;
  timeline: string;
  status: string;
  payment_url: string;
  content: {
    summary: string;
    scope: string;
    deliverables: string;
    milestones: string;
    proposal_timeline: string;
    pricing: string;
    risks: string;
    next_steps: string;
    source_label: string;
  };
};

export type ProposalProjectPayload = {
  user_id: string;
  client_name: string;
  project_name: string;
  project_type: string;
  budget: string;
  timeline: string;
  requirements: string;
  summary: string;
  scope: string;
  deliverables: string;
  milestones: string;
  proposal_timeline: string;
  pricing: string;
  risks: string;
  next_steps: string;
  payment_url: string;
  missing_information: string[];
  scope_risks: string[];
  unclear_requirements: string[];
  suggested_questions: string[];
  status: string;
};

export type ExportFormat = "pdf" | "docx";

export type GenerateProposalPayload = {
  user_id: string;
  client_name: string;
  business_type: string;
  project_goals: string;
  required_features: string;
  budget_range: string;
  timeline: string;
  call_notes: string;
};

export type GenerateTemplatePayload = {
  user_prompt: string;
  existing_categories?: string[];
};

export type AIProposalSection = "summary" | "scope" | "deliverables" | "timeline" | "pricing" | "risks" | "next_steps";

export type AIQualityReview = {
  id: number;
  project: number;
  proposal_version: number | null;
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  created_at: string;
};

export type EditSuggestion = {
  type: string;
  message: string;
};

export type EditSuggestionsResponse = {
  summary: string;
  suggestions: EditSuggestion[];
  improved_example: string;
};

export type PlanName = "free" | "pro" | "business";

export type UsageStatus = {
  plan: PlanName;
  used: number;
  limit: number | null;
  remaining: number | null;
  is_unlimited: boolean;
  period: string;
};

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function createAuthHeaders(contentType = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = "application/json";
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const expectsJson = contentType.includes("application/json");

  if (!response.ok) {
    let message = "Request failed.";
    let errorData: unknown = null;

    if (expectsJson) {
      errorData = await response.json();
      if (errorData && typeof errorData === "object" && "detail" in errorData) {
        message = String((errorData as { detail?: unknown }).detail || message);
      } else {
        message = JSON.stringify(errorData);
      }
    } else {
      message = response.statusText || message;
    }

    throw new ApiError(message, response.status, errorData);
  }

  if (!expectsJson) {
    const bodySnippet = (await response.text()).slice(0, 160);
    throw new Error(
      `API returned non-JSON content. Check VITE_API_BASE_URL. Response starts with: ${bodySnippet}`
    );
  }

  return response.json() as Promise<T>;
}

export async function getProjects(userId: string): Promise<ProposalProjectListItem[]> {
  void userId;
  const headers = await createAuthHeaders();
  const response = await fetch(`${getApiBaseUrl()}/projects/`, { headers });
  return handleResponse<ProposalProjectListItem[]>(response);
}

export async function getProject(id: string, userId: string): Promise<ProposalProject> {
  void userId;
  const headers = await createAuthHeaders();
  const response = await fetch(`${getApiBaseUrl()}/projects/${id}/`, { headers });
  return handleResponse<ProposalProject>(response);
}

export async function createProject(payload: ProposalProjectPayload): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/projects/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function generateProposal(payload: GenerateProposalPayload): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/generate/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function generateTemplateDraft(payload: GenerateTemplatePayload): Promise<TemplateDraftInput> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/generate-template/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<TemplateDraftInput>(response);
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const headers = await createAuthHeaders();
  const response = await fetch(`${getApiBaseUrl()}/usage/`, { headers });
  return handleResponse<UsageStatus>(response);
}

export async function updateProject(id: string, payload: ProposalProjectPayload): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/projects/${id}/`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function deleteProject(id: string): Promise<void> {
  const headers = await createAuthHeaders();
  const response = await fetch(`${getApiBaseUrl()}/projects/${id}/`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to delete project.");
  }
}

export async function restoreProjectVersion(
  projectId: string,
  payload: { version_id: number }
): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/restore-version/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function regenerateProposalSection(
  projectId: string,
  payload: { section: Exclude<AIProposalSection, "summary">; instructions?: string }
): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/proposals/${projectId}/regenerate-section/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function reviewProposalQuality(projectId: string): Promise<AIQualityReview> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/proposals/${projectId}/quality-review/`, {
    method: "POST",
    headers,
    body: JSON.stringify({})
  });

  return handleResponse<AIQualityReview>(response);
}

export async function getEditSuggestions(
  projectId: string,
  payload: { section: AIProposalSection; content: string }
): Promise<EditSuggestionsResponse> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/proposals/${projectId}/edit-suggestions/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<EditSuggestionsResponse>(response);
}

function parseDownloadFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return fallback;
}

export async function exportProjectDocument(
  projectId: string,
  payload: {
    format: ExportFormat;
    version_id?: number;
    final_version?: boolean;
  }
): Promise<{ blob: Blob; filename: string }> {
  const headers = await createAuthHeaders();
  const params = new URLSearchParams({ file_type: payload.format });

  if (typeof payload.version_id === "number") {
    params.set("version_id", String(payload.version_id));
  } else if (payload.final_version) {
    params.set("final_version", "true");
  }

  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/export/?${params.toString()}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    let message = "Failed to export project.";
    try {
      const data = await response.json();
      message = data.detail || JSON.stringify(data);
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fallbackFilename = `project-${projectId}.${payload.format}`;
  const filename = parseDownloadFilename(response.headers.get("Content-Disposition"), fallbackFilename);

  return { blob, filename };
}

export async function markProjectFinal(
  projectId: string,
  payload: ProposalProjectPayload
): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/mark-final/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function manageProjectShareLink(
  projectId: string,
  operation: "generate" | "regenerate" | "disable"
): Promise<ProposalProject> {
  const headers = await createAuthHeaders(true);
  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}/share-link/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ operation })
  });
  return handleResponse<ProposalProject>(response);
}

export async function getPublicProposal(token: string): Promise<PublicProposal> {
  const response = await fetch(`${getApiBaseUrl()}/public/proposals/${encodeURIComponent(token)}/`);
  return handleResponse<PublicProposal>(response);
}

export async function respondToPublicProposal(
  token: string,
  payload: { status: "approved" | "rejected"; confirmed: boolean; client_name: string; client_email: string; comment: string }
): Promise<PublicProposal> {
  const response = await fetch(`${getApiBaseUrl()}/public/proposals/${encodeURIComponent(token)}/response/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return handleResponse<PublicProposal>(response);
}

export async function addPublicProposalComment(
  token: string,
  payload: { client_name: string; client_email: string; comment: string }
): Promise<ProposalClientComment> {
  const response = await fetch(`${getApiBaseUrl()}/public/proposals/${encodeURIComponent(token)}/comments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return handleResponse<ProposalClientComment>(response);
}
