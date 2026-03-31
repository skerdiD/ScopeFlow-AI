from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from .models import ProposalProject
from .serializers import ProposalProjectSerializer


class ProposalProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProposalProjectSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = ProposalProject.objects.all()
        user_id = self.request.query_params.get("user_id")

        if not user_id:
            return queryset.none()

        return queryset.filter(user_id=user_id).order_by("-updated_at")

    def perform_create(self, serializer):
        user_id = serializer.validated_data.get("user_id")
        if not user_id:
            raise ValidationError({"user_id": "user_id is required."})

        serializer.save()


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(_request):
    return Response({"status": "ok", "service": "ScopeFlow AI API"})
