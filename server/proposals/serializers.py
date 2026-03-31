from rest_framework import serializers
from .models import ProposalProject


class ProposalProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProposalProject
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]