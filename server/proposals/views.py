import logging
import secrets

from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import AIQualityReview, AIUsageLog, AIPromptVersion, ProposalClientComment, ProposalProject, ProposalVersion
from .serializers import (
    AIQualityReviewSerializer,
    ProposalClientCommentSerializer,
    ProposalProjectListSerializer,
    ProposalProjectSerializer,
    PublicProposalResponseSerializer,
    PublicProposalSerializer,
)
from .throttling import GenerateAIActionRateThrottle, GenerateProposalRateThrottle, GenerateTemplateRateThrottle
from .services import (
    GeminiApiKeyLeakedError,
    GeminiApiKeyMissingError,
    GeminiApiRequestError,
    GeminiApiResponseError,
    GeminiQuotaExceededError,
    GeminiJsonResult,
    generate_edit_suggestions,
    generate_quality_review,
    generate_section_regeneration,
    generate_template_draft,
    generate_structured_proposal,
    get_active_prompt_version,
)
from .services.export_service import (
    build_export_filename,
    build_export_sections,
    generate_docx_export,
    generate_pdf_export,
)
from .services.usage_service import AIUsageService


logger = logging.getLogger(__name__)

SECTION_FIELDS = ["summary", "scope", "deliverables", "milestones", "proposal_timeline", "pricing", "risks", "next_steps"]
AI_SECTION_FIELDS = {"scope", "deliverables", "timeline", "pricing", "risks", "next_steps"}
AI_SECTION_TO_MODEL_FIELD = {
    "scope": "scope",
    "deliverables": "deliverables",
    "timeline": "proposal_timeline",
    "pricing": "pricing",
    "risks": "risks",
    "next_steps": "next_steps",
}
INTAKE_MAX_LENGTHS = {
    "client_name": 255,
    "business_type": 120,
    "project_goals": 2000,
    "required_features": 4000,
    "budget_range": 120,
    "timeline": 120,
    "call_notes": 4000,
    "project_name": 255,
}
TEMPLATE_PROMPT_MAX_LENGTH = 3000
TEMPLATE_CATEGORY_MAX_ITEMS = 40
TEMPLATE_CATEGORY_ITEM_MAX_LENGTH = 64
LIST_QUERY_FIELDS = [
    "id",
    "user_id",
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
    "proposal_timeline",
    "pricing",
    "risks",
    "next_steps",
    "payment_url",
    "missing_information",
    "scope_risks",
    "unclear_requirements",
    "suggested_questions",
    "status",
    "created_at",
    "updated_at",
]


def gemini_error_response(exc: Exception, operation: str) -> Response:
    logger.warning("%s failed with %s", operation, exc.__class__.__name__)

    if isinstance(exc, GeminiQuotaExceededError):
        return Response(
            {"detail": "AI generation is temporarily unavailable due to usage limits."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    if isinstance(exc, (GeminiApiKeyMissingError, GeminiApiKeyLeakedError)):
        return Response(
            {"detail": "AI generation is temporarily unavailable."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {"detail": "AI generation failed. Please try again later."},
        status=status.HTTP_502_BAD_GATEWAY,
    )


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

    latest_version_number = project.versions.aggregate(max_version=Max("version_number"))["max_version"] or 0
    version_number = latest_version_number + 1
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
        proposal_timeline=project.proposal_timeline,
        pricing=project.pricing,
        risks=project.risks,
        next_steps=project.next_steps,
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
        "timeline": normalize_string_list(project.proposal_timeline),
        "pricing": normalize_string_list(project.pricing),
        "risks": normalize_string_list(project.risks),
        "next_steps": normalize_string_list(project.next_steps),
    }


def save_generated_proposal_snapshot(project: ProposalProject):
    project.generated_proposal = build_generated_proposal_snapshot(project)
    project.save(update_fields=["generated_proposal", "updated_at"])


def build_ai_project_context(project: ProposalProject) -> dict:
    return {
        "client_name": project.client_name,
        "project_name": project.project_name,
        "project_type": project.project_type,
        "budget": project.budget,
        "timeline": project.timeline,
        "requirements": project.requirements,
        "summary": project.summary,
        "scope": project.scope,
        "deliverables": project.deliverables,
        "milestones": project.milestones,
        "proposal_timeline": project.proposal_timeline,
        "pricing": project.pricing,
        "risks": project.risks,
        "next_steps": project.next_steps,
    }


def apply_generated_proposal_to_project(project: ProposalProject, generated: dict):
    project.summary = str(generated.get("summary", "")).strip()
    project.scope = "\n".join([f"- {item}" for item in generated.get("scope_of_work", [])])
    project.deliverables = "\n".join([f"- {item}" for item in generated.get("deliverables", [])])
    project.milestones = "\n".join(
        [f"{milestone['title']}: {milestone['description']}" for milestone in generated.get("milestones", [])]
    )
    project.proposal_timeline = "\n".join([f"- {item}" for item in generated.get("timeline", [])])
    project.pricing = "\n".join([f"- {item}" for item in generated.get("pricing", [])])
    project.risks = "\n".join([f"- {item}" for item in generated.get("risks", [])])
    project.next_steps = "\n".join([f"- {item}" for item in generated.get("next_steps", [])])
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
        "proposal_timeline",
        "pricing",
        "risks",
        "next_steps",
        "payment_url",
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

    def get_serializer_class(self):
        if self.action == "list":
            return ProposalProjectListSerializer
        return ProposalProjectSerializer

    def get_queryset(self):
        queryset = ProposalProject.objects.all()
        if not self.request.user.is_authenticated:
            return queryset.none()

        owner_id = get_request_user_id(self.request)
        owner_queryset = queryset.filter(user_id=owner_id).order_by("-updated_at")
        if self.action == "list":
            return owner_queryset.only(*LIST_QUERY_FIELDS)

        return owner_queryset.select_related("current_version").prefetch_related("versions", "client_comments")

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
        project.proposal_timeline = version.proposal_timeline
        project.pricing = version.pricing
        project.risks = version.risks
        project.next_steps = version.next_steps
        project.current_version = version
        project.save()
        save_generated_proposal_snapshot(project)

        return Response(ProposalProjectSerializer(project).data)

    @action(detail=True, methods=["POST"], url_path="mark-final")
    def mark_final(self, request, pk=None):
        project = self.get_object()
        serializer = self.get_serializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        apply_request_fields_to_project(project, serializer.validated_data)
        project.save()

        create_project_version(
            project,
            source="final",
            changed_sections=SECTION_FIELDS,
            is_final=True,
        )
        save_generated_proposal_snapshot(project)

        return Response(ProposalProjectSerializer(project).data)

    @action(detail=True, methods=["POST"], url_path="share-link")
    def share_link(self, request, pk=None):
        project = self.get_object()
        operation = str(request.data.get("operation", "generate")).strip().lower()

        if operation == "disable":
            project.share_enabled = False
            project.save(update_fields=["share_enabled", "updated_at"])
            return Response(ProposalProjectSerializer(project).data)

        if operation not in {"generate", "regenerate"}:
            return Response({"detail": "operation must be generate, regenerate, or disable."}, status=status.HTTP_400_BAD_REQUEST)

        if project.is_demo:
            return Response(
                {"detail": "Demo projects cannot create public approval links."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if operation == "regenerate" or not project.share_token:
            project.share_token = secrets.token_urlsafe(32)
            project.share_created_at = timezone.now()
        project.share_enabled = True
        if project.status == "draft":
            project.status = "sent"
        project.save(update_fields=["share_token", "share_created_at", "share_enabled", "status", "updated_at"])
        return Response(ProposalProjectSerializer(project).data)

    @action(detail=True, methods=["POST"], url_path="regenerate-section", throttle_classes=[GenerateAIActionRateThrottle])
    def regenerate_section(self, request, pk=None):
        project = self.get_object()
        section = str(request.data.get("section", "")).strip().lower()
        instructions = str(request.data.get("instructions", "")).strip()

        if section not in AI_SECTION_FIELDS:
            return Response(
                {"detail": "section must be one of: scope, deliverables, timeline, pricing, risks, next_steps."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_field = AI_SECTION_TO_MODEL_FIELD[section]
        context = build_ai_project_context(project)

        try:
            content, prompt_version, token_usage = generate_section_regeneration(
                project_context=context,
                section=section,
                instructions=instructions,
            )
        except (GeminiApiKeyMissingError, GeminiApiKeyLeakedError, GeminiQuotaExceededError, GeminiApiRequestError, GeminiApiResponseError) as exc:
            AIUsageService.log_action(
                user=request.user,
                project=project,
                action_type=AIUsageLog.ACTION_SECTION_REGENERATION,
                status=AIUsageLog.STATUS_FAILURE,
                error_message=str(exc),
            )
            return gemini_error_response(exc, "Section regeneration")

        setattr(project, model_field, content)
        project.save(update_fields=[model_field, "updated_at"])
        save_generated_proposal_snapshot(project)
        create_project_version(project, source="regenerate", changed_sections=[model_field])
        AIUsageService.log_action(
            user=request.user,
            project=project,
            action_type=AIUsageLog.ACTION_SECTION_REGENERATION,
            status=AIUsageLog.STATUS_SUCCESS,
            prompt_version=prompt_version,
            token_usage=token_usage,
        )

        return Response(ProposalProjectSerializer(project).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"], url_path="quality-review", throttle_classes=[GenerateAIActionRateThrottle])
    def quality_review(self, request, pk=None):
        project = self.get_object()

        try:
            review_data, prompt_version, token_usage = generate_quality_review(project_context=build_ai_project_context(project))
        except (GeminiApiKeyMissingError, GeminiApiKeyLeakedError, GeminiQuotaExceededError, GeminiApiRequestError, GeminiApiResponseError) as exc:
            AIUsageService.log_action(
                user=request.user,
                project=project,
                action_type=AIUsageLog.ACTION_QUALITY_SCORE,
                status=AIUsageLog.STATUS_FAILURE,
                error_message=str(exc),
            )
            return gemini_error_response(exc, "Quality review")

        review = AIQualityReview.objects.create(
            project=project,
            user=request.user,
            proposal_version=project.current_version,
            prompt_version=prompt_version,
            **review_data,
        )
        AIUsageService.log_action(
            user=request.user,
            project=project,
            action_type=AIUsageLog.ACTION_QUALITY_SCORE,
            status=AIUsageLog.STATUS_SUCCESS,
            prompt_version=prompt_version,
            token_usage=token_usage,
        )
        return Response(AIQualityReviewSerializer(review).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["POST"], url_path="edit-suggestions", throttle_classes=[GenerateAIActionRateThrottle])
    def edit_suggestions(self, request, pk=None):
        project = self.get_object()
        section = str(request.data.get("section", "")).strip().lower()
        content = str(request.data.get("content", "")).strip()

        if section not in AI_SECTION_FIELDS and section != "summary":
            return Response({"detail": "section is invalid."}, status=status.HTTP_400_BAD_REQUEST)
        if not content:
            return Response({"detail": "content is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            suggestions, prompt_version, token_usage = generate_edit_suggestions(section=section, content=content)
        except (GeminiApiKeyMissingError, GeminiApiKeyLeakedError, GeminiQuotaExceededError, GeminiApiRequestError, GeminiApiResponseError) as exc:
            AIUsageService.log_action(
                user=request.user,
                project=project,
                action_type=AIUsageLog.ACTION_EDIT_SUGGESTIONS,
                status=AIUsageLog.STATUS_FAILURE,
                error_message=str(exc),
            )
            return gemini_error_response(exc, "Edit suggestions")

        AIUsageService.log_action(
            user=request.user,
            project=project,
            action_type=AIUsageLog.ACTION_EDIT_SUGGESTIONS,
            status=AIUsageLog.STATUS_SUCCESS,
            prompt_version=prompt_version,
            token_usage=token_usage,
        )
        return Response(suggestions, status=status.HTTP_200_OK)

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
        proposal_timeline = selected_version.proposal_timeline if selected_version else project.proposal_timeline
        pricing = selected_version.pricing if selected_version else project.pricing
        risks = selected_version.risks if selected_version else project.risks
        next_steps = selected_version.next_steps if selected_version else project.next_steps

        sections = build_export_sections(
            summary=summary,
            scope=scope,
            deliverables=deliverables,
            milestones=milestones,
            proposal_timeline=proposal_timeline,
            pricing=pricing,
            risks=risks,
            next_steps=next_steps,
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
@throttle_classes([GenerateProposalRateThrottle])
def generate_proposal(request):
    owner_id = get_request_user_id(request)
    can_generate, usage_status = AIUsageService.can_generate(request.user)
    if not can_generate:
        return Response(
            {
                "detail": "You have reached your monthly AI generation limit. Upgrade to generate more proposals.",
                "usage": usage_status.as_dict(),
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

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

    intake_values = {
        "client_name": client_name,
        "business_type": business_type,
        "project_goals": project_goals,
        "required_features": required_features,
        "budget_range": budget_range,
        "timeline": timeline,
        "call_notes": call_notes,
    }
    for field_name, max_length in INTAKE_MAX_LENGTHS.items():
        field_value = intake_values.get(field_name, "")
        if len(field_value) > max_length:
            return Response(
                {"detail": f"{field_name} exceeds the maximum length of {max_length} characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if not client_name:
        return Response({"detail": "client_name is required."}, status=status.HTTP_400_BAD_REQUEST)

    if not project_goals:
        return Response({"detail": "project_goals is required."}, status=status.HTTP_400_BAD_REQUEST)

    project_name = str(request.data.get("project_name", "")).strip() or f"{client_name} Proposal"
    if len(project_name) > INTAKE_MAX_LENGTHS["project_name"]:
        return Response(
            {
                "detail": (
                    f"project_name exceeds the maximum length of "
                    f"{INTAKE_MAX_LENGTHS['project_name']} characters."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    intake = {
        "client_name": client_name,
        "business_type": business_type,
        "project_goals": project_goals,
        "required_features": required_features,
        "budget_range": budget_range,
        "timeline": timeline,
        "call_notes": call_notes,
    }

    prompt_version = get_active_prompt_version(AIPromptVersion.PURPOSE_FULL_PROPOSAL)
    try:
        generated_result = generate_structured_proposal(intake, prompt_version=prompt_version, include_usage=True)
        if isinstance(generated_result, GeminiJsonResult):
            generated = generated_result.data
            token_usage = generated_result.token_usage
        else:
            generated = generated_result
            token_usage = {}
    except GeminiApiKeyMissingError as exc:
        AIUsageService.log_action(user=request.user, action_type=AIUsageLog.ACTION_FULL_PROPOSAL, status=AIUsageLog.STATUS_FAILURE, prompt_version=prompt_version, error_message=str(exc))
        return gemini_error_response(exc, "Proposal generation")
    except GeminiApiKeyLeakedError as exc:
        AIUsageService.log_action(user=request.user, action_type=AIUsageLog.ACTION_FULL_PROPOSAL, status=AIUsageLog.STATUS_FAILURE, prompt_version=prompt_version, error_message=str(exc))
        return gemini_error_response(exc, "Proposal generation")
    except GeminiQuotaExceededError as exc:
        AIUsageService.log_action(user=request.user, action_type=AIUsageLog.ACTION_FULL_PROPOSAL, status=AIUsageLog.STATUS_FAILURE, prompt_version=prompt_version, error_message=str(exc))
        return gemini_error_response(exc, "Proposal generation")
    except GeminiApiRequestError as exc:
        AIUsageService.log_action(user=request.user, action_type=AIUsageLog.ACTION_FULL_PROPOSAL, status=AIUsageLog.STATUS_FAILURE, prompt_version=prompt_version, error_message=str(exc))
        return gemini_error_response(exc, "Proposal generation")
    except GeminiApiResponseError as exc:
        AIUsageService.log_action(user=request.user, action_type=AIUsageLog.ACTION_FULL_PROPOSAL, status=AIUsageLog.STATUS_FAILURE, prompt_version=prompt_version, error_message=str(exc))
        return gemini_error_response(exc, "Proposal generation")

    with transaction.atomic():
        usage_consumed, usage_status = AIUsageService.consume_generation_if_available(request.user)
        if not usage_consumed:
            AIUsageService.log_action(
                user=request.user,
                action_type=AIUsageLog.ACTION_FULL_PROPOSAL,
                status=AIUsageLog.STATUS_FAILURE,
                prompt_version=prompt_version,
                error_message="Monthly AI generation limit reached before saving generated proposal.",
                token_usage=token_usage,
            )
            return Response(
                {
                    "detail": "You have reached your monthly AI generation limit. Upgrade to generate more proposals.",
                    "usage": usage_status.as_dict(),
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

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
            status="draft",
        )
        apply_generated_proposal_to_project(project, generated)
        project.save()

        create_project_version(project, source="generate", changed_sections=SECTION_FIELDS)
        AIUsageService.log_action(
            user=request.user,
            project=project,
            action_type=AIUsageLog.ACTION_FULL_PROPOSAL,
            status=AIUsageLog.STATUS_SUCCESS,
            prompt_version=prompt_version,
            token_usage=token_usage,
        )

    return Response(ProposalProjectSerializer(project).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def usage_status(request):
    return Response(AIUsageService.get_current_usage(request.user).as_dict(), status=status.HTTP_200_OK)


def get_shared_project(token: str) -> ProposalProject:
    return get_object_or_404(
        ProposalProject.objects.prefetch_related("versions", "client_comments"),
        share_token=token,
        share_enabled=True,
        is_demo=False,
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_proposal(request, token):
    project = get_shared_project(token)
    update_fields = []
    if project.viewed_at is None:
        project.viewed_at = timezone.now()
        update_fields.append("viewed_at")
    if project.status == "sent":
        project.status = "viewed"
        update_fields.append("status")
    if update_fields:
        update_fields.append("updated_at")
        project.save(update_fields=update_fields)
    return Response(PublicProposalSerializer(project).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def public_proposal_response(request, token):
    project = get_shared_project(token)
    serializer = PublicProposalResponseSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    response_status = serializer.validated_data["status"]
    now = timezone.now()

    project.status = response_status
    project.client_name_response = serializer.validated_data.get("client_name", "")
    project.client_email_response = serializer.validated_data.get("client_email", "")
    project.client_response_comment = serializer.validated_data.get("comment", "")
    if response_status == "approved":
        project.approved_at = now
        project.rejected_at = None
    else:
        project.rejected_at = now
        project.approved_at = None
    project.save()

    comment = project.client_response_comment.strip()
    if comment:
        ProposalClientComment.objects.create(
            project=project,
            client_name=project.client_name_response,
            client_email=project.client_email_response,
            comment=comment,
        )

    return Response(PublicProposalSerializer(project).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def public_proposal_comment(request, token):
    project = get_shared_project(token)
    serializer = ProposalClientCommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(project=project)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([GenerateTemplateRateThrottle])
def generate_template(request):
    user_prompt = str(request.data.get("user_prompt", "")).strip()
    existing_categories = normalize_string_list(request.data.get("existing_categories", []))

    if not user_prompt:
        return Response({"detail": "user_prompt is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(user_prompt) > TEMPLATE_PROMPT_MAX_LENGTH:
        return Response(
            {"detail": f"user_prompt exceeds the maximum length of {TEMPLATE_PROMPT_MAX_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(existing_categories) > TEMPLATE_CATEGORY_MAX_ITEMS:
        return Response(
            {
                "detail": (
                    f"existing_categories allows up to {TEMPLATE_CATEGORY_MAX_ITEMS} items."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    for category in existing_categories:
        if len(category) > TEMPLATE_CATEGORY_ITEM_MAX_LENGTH:
            return Response(
                {
                    "detail": (
                        "each existing_categories item must be at most "
                        f"{TEMPLATE_CATEGORY_ITEM_MAX_LENGTH} characters."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    try:
        generated_template = generate_template_draft(
            user_prompt=user_prompt,
            existing_categories=existing_categories,
        )
    except GeminiApiKeyMissingError as exc:
        return gemini_error_response(exc, "Template generation")
    except GeminiApiKeyLeakedError as exc:
        return gemini_error_response(exc, "Template generation")
    except GeminiQuotaExceededError as exc:
        return gemini_error_response(exc, "Template generation")
    except GeminiApiRequestError as exc:
        return gemini_error_response(exc, "Template generation")
    except GeminiApiResponseError as exc:
        return gemini_error_response(exc, "Template generation")

    return Response(generated_template, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok", "service": "ScopeFlow AI API"})
