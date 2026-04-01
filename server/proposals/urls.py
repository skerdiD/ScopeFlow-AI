from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProposalProjectViewSet, health_check

router = DefaultRouter()
router.register("projects", ProposalProjectViewSet, basename="proposal-project")

urlpatterns = [
    path("health/", health_check),
    path("", include(router.urls)),
]
