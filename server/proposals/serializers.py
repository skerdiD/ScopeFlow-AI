from rest_framework import serializers

from .demo import is_demo_user
from .models import AIQualityReview, ProposalClientComment, ProposalProject, ProposalVersion


PROJECT_TEXT_MAX_LENGTHS = {
    "requirements": 8000,
    "summary": 8000,
    "scope": 8000,
    "deliverables": 8000,
    "milestones": 8000,
    "proposal_timeline": 8000,
    "pricing": 8000,
    "risks": 8000,
    "next_steps": 8000,
}
PROJECT_LIST_FIELDS = [
    "missing_information",
    "scope_risks",
    "unclear_requirements",
    "suggested_questions",
]
PROJECT_LIST_MAX_ITEMS = 100
PROJECT_LIST_ITEM_MAX_LENGTH = 500


def validate_project_payload(attrs):
    errors = {}

    for field_name, max_length in PROJECT_TEXT_MAX_LENGTHS.items():
        value = attrs.get(field_name)
        if isinstance(value, str) and len(value) > max_length:
            errors[field_name] = f"Must be at most {max_length} characters."

    for field_name in PROJECT_LIST_FIELDS:
        if field_name not in attrs:
            continue

        value = attrs.get(field_name)
        if not isinstance(value, list):
            errors[field_name] = "Must be a list."
            continue

        if len(value) > PROJECT_LIST_MAX_ITEMS:
            errors[field_name] = f"Must contain at most {PROJECT_LIST_MAX_ITEMS} items."
            continue

        if any(len(str(item)) > PROJECT_LIST_ITEM_MAX_LENGTH for item in value):
            errors[field_name] = f"Each item must be at most {PROJECT_LIST_ITEM_MAX_LENGTH} characters."

    if errors:
        raise serializers.ValidationError(errors)

    return attrs


class ProposalVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProposalVersion
        fields = [
            "id",
            "project",
            "version_number",
            "label",
            "source",
            "changed_sections",
            "summary",
            "scope",
            "deliverables",
            "milestones",
            "proposal_timeline",
            "pricing",
            "risks",
            "next_steps",
            "is_final",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ProposalClientCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProposalClientComment
        fields = ["id", "client_name", "client_email", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"comment": {"max_length": 8000}}


class PublicProposalResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["approved", "rejected"])
    confirmed = serializers.BooleanField(default=False)
    client_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    client_email = serializers.EmailField(required=False, allow_blank=True)
    comment = serializers.CharField(max_length=8000, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["status"] == "approved" and not attrs.get("confirmed"):
            raise serializers.ValidationError({"confirmed": "Approval confirmation is required."})
        return attrs


class ProposalProjectSerializer(serializers.ModelSerializer):
    versions = ProposalVersionSerializer(many=True, read_only=True)
    client_comments = ProposalClientCommentSerializer(many=True, read_only=True)
    current_version_id = serializers.SerializerMethodField()

    class Meta:
        model = ProposalProject
        fields = [
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
            "generated_proposal",
            "current_version_id",
            "versions",
            "status",
            "share_token",
            "share_enabled",
            "share_created_at",
            "viewed_at",
            "client_name_response",
            "client_email_response",
            "client_response_comment",
            "approved_at",
            "rejected_at",
            "is_demo",
            "client_comments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user_id",
            "created_at",
            "updated_at",
            "versions",
            "current_version_id",
            "generated_proposal",
            "share_token",
            "share_enabled",
            "share_created_at",
            "viewed_at",
            "client_name_response",
            "client_email_response",
            "client_response_comment",
            "approved_at",
            "rejected_at",
            "is_demo",
            "client_comments",
        ]

    def get_current_version_id(self, obj):
        return obj.current_version_id

    def validate(self, attrs):
        request = self.context.get("request")
        if request and is_demo_user(request.user) and attrs.get("payment_url"):
            raise serializers.ValidationError({"payment_url": "Payment links are disabled in demo mode."})
        return validate_project_payload(attrs)


class ProposalProjectListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProposalProject
        fields = [
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
        read_only_fields = [
            "id",
            "user_id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        return validate_project_payload(attrs)


class PublicProposalSerializer(serializers.ModelSerializer):
    content = serializers.SerializerMethodField()

    class Meta:
        model = ProposalProject
        fields = [
            "project_name",
            "client_name",
            "project_type",
            "budget",
            "timeline",
            "status",
            "payment_url",
            "content",
        ]

    def get_content(self, obj):
        final_version = obj.versions.filter(is_final=True).order_by("-created_at").first()
        source = final_version or obj
        return {
            "summary": source.summary,
            "scope": source.scope,
            "deliverables": source.deliverables,
            "milestones": source.milestones,
            "proposal_timeline": source.proposal_timeline,
            "pricing": source.pricing,
            "risks": source.risks,
            "next_steps": source.next_steps,
            "source_label": final_version.label if final_version else "current",
        }


class AIQualityReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIQualityReview
        fields = [
            "id",
            "project",
            "proposal_version",
            "score",
            "summary",
            "strengths",
            "weaknesses",
            "recommendations",
            "created_at",
        ]
        read_only_fields = fields
