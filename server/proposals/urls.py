from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ProposalProjectViewSet,
    generate_proposal,
    generate_template,
    health_check,
    public_proposal,
    public_proposal_comment,
    public_proposal_response,
    usage_status,
    workspace_overview,
)

router = DefaultRouter()
router.register("projects", ProposalProjectViewSet, basename="proposal-project")

urlpatterns = [
    path("health/", health_check),
    path("generate/", generate_proposal),
    path("generate-template/", generate_template),
    path("usage/", usage_status),
    path("workspace/", workspace_overview),
    path("public/proposals/<str:token>/", public_proposal),
    path("public/proposals/<str:token>/response/", public_proposal_response),
    path("public/proposals/<str:token>/comments/", public_proposal_comment),
    path(
        "proposals/<int:pk>/regenerate-section/",
        ProposalProjectViewSet.as_view({"post": "regenerate_section"}),
    ),
    path(
        "proposals/<int:pk>/quality-review/",
        ProposalProjectViewSet.as_view({"post": "quality_review"}),
    ),
    path(
        "proposals/<int:pk>/edit-suggestions/",
        ProposalProjectViewSet.as_view({"post": "edit_suggestions"}),
    ),
    path("", include(router.urls)),
]
