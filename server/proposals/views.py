from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import ProposalProject, ProposalVersion
from .serializers import ProposalProjectSerializer
from .services import (
    GeminiApiKeyLeakedError,
    GeminiApiKeyMissingError,
    GeminiApiRequestError,
    GeminiApiResponseError,
    GeminiQuotaExceededError,
    generate_template_draft,
    generate_structured_proposal,
)
from .services.export_service import (
    build_export_filename,
    build_export_sections,
    generate_docx_export,
    generate_pdf_export,
)


SECTION_FIELDS = ["summary", "scope", "deliverables", "milestones", "risks"]


def get_request_user_id(request) -> str:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication required.")

    user_id = str(user.get_username() or "").strip()
    if not user_id:
        raise PermissionDenied("Authenticated user identity is missing.")
    return user_id


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
        "risks": normalize_string_list(project.risks),
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
    project.risks = "\n".join([f"- {item}" for item in generated.get("risks", [])])
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
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ProposalProject.objects.all()
        if not self.request.user.is_authenticated:
            return queryset.none()

        owner_id = get_request_user_id(self.request)
        return queryset.filter(user_id=owner_id).order_by("-updated_at")

    def perform_create(self, serializer):
        owner_id = get_request_user_id(self.request)
        project = serializer.save(user_id=owner_id)
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
        version_id = request.data.get("version_id")

        if not version_id:
            return Response(
                {"detail": "version_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = self.get_object()
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
        project = self.get_object()
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

    @action(detail=True, methods=["GET"], url_path="export")
    def export_project(self, request, pk=None):
        project = self.get_object()
        export_format = str(
            request.query_params.get("file_type", "") or request.query_params.get("export_format", "")
        ).strip().lower()
        version_id_raw = str(request.query_params.get("version_id", "")).strip()
        final_version_raw = str(request.query_params.get("final_version", "")).strip().lower()

        if export_format not in {"pdf", "docx"}:
            return Response(
                {"detail": "file_type must be either 'pdf' or 'docx'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        selected_version = None
        source_label = "current"

        if version_id_raw:
            try:
                version_id = int(version_id_raw)
            except ValueError:
                return Response(
                    {"detail": "version_id must be a numeric value."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            selected_version = get_object_or_404(project.versions, id=version_id)
            source_label = selected_version.label or f"v{selected_version.version_number}"
        elif final_version_raw in {"1", "true", "yes", "on"}:
            selected_version = project.versions.filter(is_final=True).order_by("-created_at").first()
            if not selected_version:
                return Response(
                    {"detail": "Final version not found for this project."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            source_label = selected_version.label or "final"

        summary = selected_version.summary if selected_version else project.summary
        scope = selected_version.scope if selected_version else project.scope
        deliverables = selected_version.deliverables if selected_version else project.deliverables
        milestones = selected_version.milestones if selected_version else project.milestones
        risks = selected_version.risks if selected_version else project.risks

        sections = build_export_sections(
            summary=summary,
            scope=scope,
            deliverables=deliverables,
            milestones=milestones,
            risks=risks,
        )

        if export_format == "pdf":
            document_bytes = generate_pdf_export(
                project_name=project.project_name,
                client_name=project.client_name,
                project_type=project.project_type,
                budget=project.budget,
                timeline=project.timeline,
                source_label=source_label,
                sections=sections,
            )
            content_type = "application/pdf"
            extension = "pdf"
        else:
            document_bytes = generate_docx_export(
                project_name=project.project_name,
                client_name=project.client_name,
                project_type=project.project_type,
                budget=project.budget,
                timeline=project.timeline,
                source_label=source_label,
                sections=sections,
            )
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            extension = "docx"

        filename = build_export_filename(project.project_name, source_label, extension)

        response = HttpResponse(document_bytes, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def generate_proposal(request):
    owner_id = get_request_user_id(request)
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
        user_id=owner_id,
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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def generate_template(request):
    user_prompt = str(request.data.get("user_prompt", "")).strip()
    existing_categories = normalize_string_list(request.data.get("existing_categories", []))

    if not user_prompt:
        return Response({"detail": "user_prompt is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        generated_template = generate_template_draft(
            user_prompt=user_prompt,
            existing_categories=existing_categories,
        )
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

    return Response(generated_template, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok", "service": "ScopeFlow AI API"})
