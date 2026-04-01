from rest_framework import serializers

from .models import ProposalProject, ProposalVersion


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
            "risks",
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
            "risks",
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
        read_only_fields = ["id", "created_at", "updated_at", "versions", "current_version_id", "generated_proposal"]

    def get_current_version_id(self, obj):
        return obj.current_version_id
