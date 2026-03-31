import json
import os

import requests
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import ProposalProject
from .serializers import ProposalProjectSerializer


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")


PROPOSAL_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "scope": {"type": "string"},
        "deliverables": {"type": "string"},
        "milestones": {"type": "string"},
        "risks": {"type": "string"},
    },
    "required": ["summary", "scope", "deliverables", "milestones", "risks"],
}


class ProposalProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProposalProjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = ProposalProject.objects.all()
        user_id = self.request.query_params.get("user_id")

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        return queryset.order_by("-updated_at")


def build_generation_prompt(project: ProposalProject) -> str:
    return f"""
You are an expert SaaS proposal strategist for freelancers and agencies.

Generate a professional proposal draft from the project details below.

Rules:
- Return content that fits the provided JSON schema exactly.
- Write clearly and professionally.
- Be specific and practical.
- Keep each section concise but useful.
- Use plain text only.
- For deliverables and milestones, format them as short bullet-style lines within a single string.
- For risks, include missing information, assumptions, and possible scope creep concerns.

Project details:
Client Name: {project.client_name}
Project Name: {project.project_name}
Project Type: {project.project_type}
Budget: {project.budget}
Timeline: {project.timeline}
Requirements: {project.requirements}
Current Summary: {project.summary}
Current Scope: {project.scope}
Current Deliverables: {project.deliverables}
Current Milestones: {project.milestones}
Current Risks: {project.risks}

JSON Schema:
{json.dumps(PROPOSAL_SCHEMA)}
""".strip()


def clean_json_text(raw_text: str) -> dict:
    text = raw_text.strip()

    if text.startswith("```"):
      lines = text.splitlines()
      if len(lines) >= 3:
          text = "\n".join(lines[1:-1]).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")

        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])

        raise


def normalize_generated_sections(data: dict) -> dict:
    return {
        "summary": str(data.get("summary", "")).strip(),
        "scope": str(data.get("scope", "")).strip(),
        "deliverables": str(data.get("deliverables", "")).strip(),
        "milestones": str(data.get("milestones", "")).strip(),
        "risks": str(data.get("risks", "")).strip(),
    }


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def generate_proposal(request):
    project_id = request.data.get("project_id")
    user_id = request.data.get("user_id")

    if not project_id or not user_id:
        return Response(
            {"detail": "project_id and user_id are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    project = get_object_or_404(ProposalProject, id=project_id, user_id=user_id)

    editable_fields = [
        "client_name",
        "project_name",
        "project_type",
        "budget",
        "timeline",
        "requirements",
        "summary",
        "scope",
        "deliverables",
        "milestones",
        "risks",
        "status",
    ]

    for field in editable_fields:
        if field in request.data:
            setattr(project, field, request.data.get(field) or "")

    prompt = build_generation_prompt(project)

    try:
        ollama_response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": PROPOSAL_SCHEMA,
                "options": {
                    "temperature": 0,
                },
            },
            timeout=180,
        )
        ollama_response.raise_for_status()
    except requests.RequestException as exc:
        return Response(
            {"detail": f"Failed to contact Ollama: {str(exc)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    response_data = ollama_response.json()
    raw_model_output = response_data.get("response", "")

    try:
        parsed = clean_json_text(raw_model_output)
        generated = normalize_generated_sections(parsed)
    except (json.JSONDecodeError, TypeError, ValueError):
        return Response(
            {"detail": "Failed to parse Ollama response into structured JSON."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    project.summary = generated["summary"]
    project.scope = generated["scope"]
    project.deliverables = generated["deliverables"]
    project.milestones = generated["milestones"]
    project.risks = generated["risks"]
    project.status = "in_review"
    project.save()

    return Response(generated, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok", "service": "ScopeFlow AI API"})