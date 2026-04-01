from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import ProposalProject, ProposalVersion
from .serializers import ProposalProjectSerializer
from .services import (
    GeminiApiKeyLeakedError,
    GeminiApiKeyMissingError,
    GeminiApiRequestError,
    GeminiApiResponseError,
    GeminiQuotaExceededError,
    generate_structured_proposal,
)


SECTION_FIELDS = ["summary", "scope", "deliverables", "milestones", "risks"]


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


def normalize_string_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        parts = []
        for line in value.splitlines():
            cleaned = line.strip().lstrip("-").lstrip("*").strip()
            if cleaned:
                parts.append(cleaned)
        return parts

    return []


def parse_milestone_list(value) -> list[dict[str, str]]:
    milestones = []

    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()
            description = str(item.get("description", "")).strip()
            if title and description:
                milestones.append({"title": title, "description": description})
        return milestones

    if isinstance(value, str):
        for line in value.splitlines():
            cleaned = line.strip().lstrip("-").lstrip("*").strip()
            if not cleaned:
                continue
            parts = cleaned.split(":", 1)
            if len(parts) == 2:
                title = parts[0].strip()
                description = parts[1].strip()
            else:
                title = cleaned
                description = "Implementation details and delivery checkpoint."
            if title and description:
                milestones.append({"title": title, "description": description})

    return milestones


def build_generated_proposal_snapshot(project: ProposalProject) -> dict:
    return {
        "summary": project.summary or "",
        "scope_of_work": normalize_string_list(project.scope),
        "deliverables": normalize_string_list(project.deliverables),
        "milestones": parse_milestone_list(project.milestones),
    }


def save_generated_proposal_snapshot(project: ProposalProject):
    project.generated_proposal = build_generated_proposal_snapshot(project)
    project.save(update_fields=["generated_proposal", "updated_at"])


def apply_generated_proposal_to_project(project: ProposalProject, generated: dict):
    project.summary = str(generated.get("summary", "")).strip()
    project.scope = "\n".join([f"- {item}" for item in generated.get("scope_of_work", [])])
    project.deliverables = "\n".join([f"- {item}" for item in generated.get("deliverables", [])])
    project.milestones = "\n".join(
        [f"{milestone['title']}: {milestone['description']}" for milestone in generated.get("milestones", [])]
    )
    project.generated_proposal = generated


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
        save_generated_proposal_snapshot(project)
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

        save_generated_proposal_snapshot(project)
        output = self.get_serializer(project)
        return Response(output.data)

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
        save_generated_proposal_snapshot(project)

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
        save_generated_proposal_snapshot(project)

        return Response(ProposalProjectSerializer(project).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def generate_proposal(request):
    user_id = str(request.data.get("user_id", "")).strip()
    client_name = str(request.data.get("client_name", "")).strip()
    business_type = str(
        request.data.get("business_type")
        or request.data.get("project_type")
        or ""
    ).strip()
    project_goals = str(
        request.data.get("project_goals")
        or request.data.get("project_name")
        or ""
    ).strip()
    required_features = str(
        request.data.get("required_features")
        or request.data.get("requirements")
        or ""
    ).strip()
    budget_range = str(
        request.data.get("budget_range")
        or request.data.get("budget")
        or ""
    ).strip()
    timeline = str(request.data.get("timeline", "")).strip()
    call_notes = str(request.data.get("call_notes", "")).strip()

    if not user_id:
        return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    if not client_name:
        return Response({"detail": "client_name is required."}, status=status.HTTP_400_BAD_REQUEST)

    if not project_goals:
        return Response({"detail": "project_goals is required."}, status=status.HTTP_400_BAD_REQUEST)

    intake = {
        "client_name": client_name,
        "business_type": business_type,
        "project_goals": project_goals,
        "required_features": required_features,
        "budget_range": budget_range,
        "timeline": timeline,
        "call_notes": call_notes,
    }

    try:
        generated = generate_structured_proposal(intake)
    except GeminiApiKeyMissingError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except GeminiApiKeyLeakedError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except GeminiQuotaExceededError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    except GeminiApiRequestError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
    except GeminiApiResponseError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    project_name = str(request.data.get("project_name", "")).strip() or f"{client_name} Proposal"

    requirement_sections = [f"Project goals: {project_goals}"]
    if required_features:
        requirement_sections.append(f"Required features: {required_features}")
    if call_notes:
        requirement_sections.append(f"Call notes: {call_notes}")

    project = ProposalProject(
        user_id=user_id,
        client_name=client_name,
        project_name=project_name,
        project_type=business_type,
        budget=budget_range,
        timeline=timeline,
        requirements="\n".join(requirement_sections).strip(),
        status="in_review",
    )
    apply_generated_proposal_to_project(project, generated)
    project.save()

    create_project_version(project, source="generate", changed_sections=SECTION_FIELDS)

    return Response(ProposalProjectSerializer(project).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok", "service": "ScopeFlow AI API"})
