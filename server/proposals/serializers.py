from rest_framework import serializers

from .models import AIQualityReview, ProposalProject, ProposalVersion


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


class ProposalProjectSerializer(serializers.ModelSerializer):
    versions = ProposalVersionSerializer(many=True, read_only=True)
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
            "missing_information",
            "scope_risks",
            "unclear_requirements",
            "suggested_questions",
            "generated_proposal",
            "current_version_id",
            "versions",
            "status",
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
        ]

    def get_current_version_id(self, obj):
        return obj.current_version_id

    def validate(self, attrs):
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
