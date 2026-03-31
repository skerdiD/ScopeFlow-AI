import json
import os

import requests
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import ProposalProject, ProposalVersion
from .serializers import ProposalProjectSerializer


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

SECTION_FIELDS = ["summary", "scope", "deliverables", "milestones", "risks"]

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

INSIGHTS_SCHEMA = {
    "type": "object",
    "properties": {
        "missing_information": {
            "type": "array",
            "items": {"type": "string"},
        },
        "scope_risks": {
            "type": "array",
            "items": {"type": "string"},
        },
        "unclear_requirements": {
            "type": "array",
            "items": {"type": "string"},
        },
        "suggested_questions": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": [
        "missing_information",
        "scope_risks",
        "unclear_requirements",
        "suggested_questions",
    ],
}


def snapshot_sections(project: ProposalProject) -> dict:
    return {field: getattr(project, field, "") for field in SECTION_FIELDS}


def relabel_previous_final_versions(project: ProposalProject):
    for version in project.versions.filter(is_final=True):
        version.is_final = False
        if version.label == "final":
            version.label = f"v{version.version_number}"
        version.save(update_fields=["is_final", "label"])


def create_project_version(
    project: ProposalProject,
    source: str,
    changed_sections=None,
    label: str | None = None,
    is_final: bool = False,
):
    if is_final:
        relabel_previous_final_versions(project)

    version_number = project.versions.count() + 1
    version_label = label or ("final" if is_final else f"v{version_number}")

    version = ProposalVersion.objects.create(
        project=project,
        version_number=version_number,
        label=version_label,
        source=source,
        changed_sections=changed_sections or [],
        summary=project.summary,
        scope=project.scope,
        deliverables=project.deliverables,
        milestones=project.milestones,
        risks=project.risks,
        is_final=is_final,
    )

    project.current_version = version
    project.save(update_fields=["current_version", "updated_at"])
    return version


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


def build_insights_prompt(project: ProposalProject) -> str:
    return f"""
You are an AI project scoping analyst for freelancers and agencies.

Analyze the project details and return intelligent insights that help the user ask better questions and avoid bad scope.

Rules:
- Return valid JSON only matching the provided schema exactly.
- Each list item must be short, specific, and useful.
- Do not repeat the same point in multiple sections.
- Focus on practical project ambiguity, scope gaps, delivery risks, and missing client information.
- Suggested questions should be clear and ready to ask a client directly.

Project details:
Client Name: {project.client_name}
Project Name: {project.project_name}
Project Type: {project.project_type}
Budget: {project.budget}
Timeline: {project.timeline}
Requirements: {project.requirements}
Summary: {project.summary}
Scope: {project.scope}
Deliverables: {project.deliverables}
Milestones: {project.milestones}
Risks: {project.risks}

JSON Schema:
{json.dumps(INSIGHTS_SCHEMA)}
""".strip()


def build_section_regeneration_prompt(project: ProposalProject, section: str) -> str:
    schema = {
        "type": "object",
        "properties": {
            section: {"type": "string"},
        },
        "required": [section],
    }

    return f"""
You are an expert SaaS proposal strategist for freelancers and agencies.

Regenerate only the "{section}" section for the proposal below.

Rules:
- Return valid JSON only matching the provided schema exactly.
- Only improve the requested section.
- Be concise, clear, and practical.
- Keep the content aligned with the project requirements, budget, and timeline.
- For deliverables and milestones, use short bullet-style lines within a single string.

Project details:
Client Name: {project.client_name}
Project Name: {project.project_name}
Project Type: {project.project_type}
Budget: {project.budget}
Timeline: {project.timeline}
Requirements: {project.requirements}
Summary: {project.summary}
Scope: {project.scope}
Deliverables: {project.deliverables}
Milestones: {project.milestones}
Risks: {project.risks}

Target Section:
{section}

JSON Schema:
{json.dumps(schema)}
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


def normalize_string_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        parts = []
        for line in value.splitlines():
            cleaned = line.strip().lstrip("-").lstrip("•").strip()
            if cleaned:
                parts.append(cleaned)
        return parts

    return []


def normalize_insights_sections(data: dict) -> dict:
    return {
        "missing_information": normalize_string_list(data.get("missing_information", [])),
        "scope_risks": normalize_string_list(data.get("scope_risks", [])),
        "unclear_requirements": normalize_string_list(data.get("unclear_requirements", [])),
        "suggested_questions": normalize_string_list(data.get("suggested_questions", [])),
    }


def apply_request_fields_to_project(project: ProposalProject, payload: dict) -> None:
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
        if field in payload:
            value = payload.get(field)
            setattr(project, field, value or "")

    if "missing_information" in payload:
        project.missing_information = normalize_string_list(payload.get("missing_information", []))

    if "scope_risks" in payload:
        project.scope_risks = normalize_string_list(payload.get("scope_risks", []))

    if "unclear_requirements" in payload:
        project.unclear_requirements = normalize_string_list(payload.get("unclear_requirements", []))

    if "suggested_questions" in payload:
        project.suggested_questions = normalize_string_list(payload.get("suggested_questions", []))


def request_ollama(prompt: str, schema: dict) -> dict:
    ollama_response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": schema,
            "options": {
                "temperature": 0,
            },
        },
        timeout=180,
    )
    ollama_response.raise_for_status()
    response_data = ollama_response.json()
    raw_model_output = response_data.get("response", "")
    return clean_json_text(raw_model_output)


class ProposalProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProposalProjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = ProposalProject.objects.all()
        user_id = self.request.query_params.get("user_id")

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        return queryset.order_by("-updated_at")

    def perform_create(self, serializer):
        project = serializer.save()
        if any(getattr(project, field, "").strip() for field in SECTION_FIELDS):
            create_project_version(project, source="manual", changed_sections=SECTION_FIELDS)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        before = snapshot_sections(instance)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        project = serializer.instance
        changed_sections = [
            field for field in SECTION_FIELDS if before.get(field, "") != getattr(project, field, "")
        ]

        if changed_sections:
            create_project_version(project, source="manual", changed_sections=changed_sections)

        output = self.get_serializer(project)
        return Response(output.data)

    @action(detail=True, methods=["POST"], url_path="regenerate-section")
    def regenerate_section(self, request, pk=None):
        user_id = request.data.get("user_id")
        section = request.data.get("section")

        if not user_id or not section:
            return Response(
                {"detail": "user_id and section are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if section not in SECTION_FIELDS:
            return Response(
                {"detail": "Invalid section."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = get_object_or_404(ProposalProject, id=pk, user_id=user_id)
        apply_request_fields_to_project(project, request.data)

        try:
            parsed = request_ollama(
                build_section_regeneration_prompt(project, section),
                {
                    "type": "object",
                    "properties": {section: {"type": "string"}},
                    "required": [section],
                },
            )
            regenerated_value = str(parsed.get(section, "")).strip()
        except requests.RequestException as exc:
            return Response(
                {"detail": f"Failed to contact Ollama: {str(exc)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except (json.JSONDecodeError, TypeError, ValueError):
            return Response(
                {"detail": "Failed to parse regenerated section response."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        setattr(project, section, regenerated_value)
        project.status = "in_review"
        project.save()
        create_project_version(project, source="regenerate", changed_sections=[section])

        return Response(ProposalProjectSerializer(project).data)

    @action(detail=True, methods=["POST"], url_path="restore-version")
    def restore_version(self, request, pk=None):
        user_id = request.data.get("user_id")
        version_id = request.data.get("version_id")

        if not user_id or not version_id:
            return Response(
                {"detail": "user_id and version_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = get_object_or_404(ProposalProject, id=pk, user_id=user_id)
        version = get_object_or_404(project.versions, id=version_id)

        project.summary = version.summary
        project.scope = version.scope
        project.deliverables = version.deliverables
        project.milestones = version.milestones
        project.risks = version.risks
        project.current_version = version
        project.save()

        return Response(ProposalProjectSerializer(project).data)

    @action(detail=True, methods=["POST"], url_path="mark-final")
    def mark_final(self, request, pk=None):
        user_id = request.data.get("user_id")

        if not user_id:
            return Response(
                {"detail": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = get_object_or_404(ProposalProject, id=pk, user_id=user_id)
        apply_request_fields_to_project(project, request.data)
        project.status = "completed"
        project.save()

        create_project_version(
            project,
            source="final",
            changed_sections=SECTION_FIELDS,
            is_final=True,
        )

        return Response(ProposalProjectSerializer(project).data)


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
    apply_request_fields_to_project(project, request.data)

    try:
        parsed = request_ollama(build_generation_prompt(project), PROPOSAL_SCHEMA)
        generated = normalize_generated_sections(parsed)
    except requests.RequestException as exc:
        return Response(
            {"detail": f"Failed to contact Ollama: {str(exc)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
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

    create_project_version(project, source="generate", changed_sections=SECTION_FIELDS)

    return Response(generated, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def generate_insights(request):
    project_id = request.data.get("project_id")
    user_id = request.data.get("user_id")

    if not project_id or not user_id:
        return Response(
            {"detail": "project_id and user_id are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    project = get_object_or_404(ProposalProject, id=project_id, user_id=user_id)
    apply_request_fields_to_project(project, request.data)

    try:
        parsed = request_ollama(build_insights_prompt(project), INSIGHTS_SCHEMA)
        insights = normalize_insights_sections(parsed)
    except requests.RequestException as exc:
        return Response(
            {"detail": f"Failed to contact Ollama: {str(exc)}"},
            status=status.HTTP_502_BAD_GATEWAY,
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        return Response(
            {"detail": "Failed to parse Ollama insights response into structured JSON."},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    project.missing_information = insights["missing_information"]
    project.scope_risks = insights["scope_risks"]
    project.unclear_requirements = insights["unclear_requirements"]
    project.suggested_questions = insights["suggested_questions"]
    project.save()

    return Response(insights, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok", "service": "ScopeFlow AI API"})