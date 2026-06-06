import os
from io import StringIO


DEMO_EMAIL = os.getenv("DEMO_ACCOUNT_EMAIL", "demo@scopeflow.ai").strip().lower()
DEMO_USERNAME_PREFIX = "demo-seed-"
DEMO_RESTRICTION_MESSAGE = "This action is disabled in demo mode."
DEMO_PROJECT_COUNT = 10
DEMO_WORKSPACE_CACHE_TTL_SECONDS = 300


def is_demo_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False

    email = str(getattr(user, "email", "") or "").strip().lower()
    username = str(user.get_username() or "").strip().lower()
    return email == DEMO_EMAIL or username.startswith(DEMO_USERNAME_PREFIX)


def ensure_demo_workspace(user) -> None:
    """Repair missing demo data in the database currently serving API requests."""
    if not is_demo_user(user):
        return

    from django.core.management import call_command
    from django.core.cache import cache
    from django.db import transaction

    from .models import ProposalProject, UsageRecord, UserPlan
    from .services.usage_service import AIUsageService

    cache_key = f"demo_workspace_verified:{user.pk}"
    if cache.get(cache_key):
        return

    with transaction.atomic():
        locked_user = type(user).objects.select_for_update().get(pk=user.pk)
        if cache.get(cache_key):
            return

        owner_id = str(locked_user.get_username() or "").strip()
        has_projects = (
            ProposalProject.objects.filter(user_id=owner_id, is_demo=True).count()
            >= DEMO_PROJECT_COUNT
        )
        has_plan = UserPlan.objects.filter(user=locked_user, plan=UserPlan.PLAN_PRO).exists()
        has_usage = UsageRecord.objects.filter(
            user=locked_user,
            period=AIUsageService.current_period(),
        ).exists()

        if has_projects and has_plan and has_usage:
            cache.set(cache_key, True, timeout=DEMO_WORKSPACE_CACHE_TTL_SECONDS)
            return

        call_command(
            "seed_demo_data",
            email=locked_user.email,
            stdout=StringIO(),
            stderr=StringIO(),
            verbosity=0,
        )
        cache.set(cache_key, True, timeout=DEMO_WORKSPACE_CACHE_TTL_SECONDS)
