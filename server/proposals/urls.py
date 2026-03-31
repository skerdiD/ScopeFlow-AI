from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProposalProjectViewSet, generate_insights, generate_proposal, health_check

router = DefaultRouter()
router.register("projects", ProposalProjectViewSet, basename="proposal-project")

urlpatterns = [
    path("health/", health_check),
    path("generate/", generate_proposal),
    path("insights/", generate_insights),
    path("", include(router.urls)),
]