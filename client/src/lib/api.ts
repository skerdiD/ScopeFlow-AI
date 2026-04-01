const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  "http://127.0.0.1:8000/api";

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
  risks: string;
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
  risks: string;
  missing_information: string[];
  scope_risks: string[];
  unclear_requirements: string[];
  suggested_questions: string[];
  generated_proposal: GeneratedProposalContent | null;
  current_version_id: number | null;
  versions: ProposalVersion[];
  status: string;
  created_at: string;
  updated_at: string;
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
  risks: string;
  missing_information: string[];
  scope_risks: string[];
  unclear_requirements: string[];
  suggested_questions: string[];
  status: string;
};

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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Request failed.";

    try {
      const data = await response.json();
      message = data.detail || JSON.stringify(data);
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function getProjects(userId: string): Promise<ProposalProject[]> {
  const response = await fetch(`${API_BASE_URL}/projects/?user_id=${encodeURIComponent(userId)}`);
  return handleResponse<ProposalProject[]>(response);
}

export async function getProject(id: string, userId: string): Promise<ProposalProject> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}/?user_id=${encodeURIComponent(userId)}`);
  return handleResponse<ProposalProject>(response);
}

export async function createProject(payload: ProposalProjectPayload): Promise<ProposalProject> {
  const response = await fetch(`${API_BASE_URL}/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function generateProposal(payload: GenerateProposalPayload): Promise<ProposalProject> {
  const response = await fetch(`${API_BASE_URL}/generate/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function updateProject(id: string, payload: ProposalProjectPayload): Promise<ProposalProject> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}/`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/projects/${id}/`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to delete project.");
  }
}

export async function restoreProjectVersion(
  projectId: string,
  payload: { user_id: string; version_id: number }
): Promise<ProposalProject> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/restore-version/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}

export async function markProjectFinal(
  projectId: string,
  payload: ProposalProjectPayload
): Promise<ProposalProject> {
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/mark-final/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return handleResponse<ProposalProject>(response);
}
