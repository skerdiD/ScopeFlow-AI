from dataclasses import dataclass
from datetime import date

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from proposals.models import AIUsageLog, UsageRecord, UserPlan


PLAN_LIMITS = {
    UserPlan.PLAN_FREE: 3,
    UserPlan.PLAN_PRO: 50,
    UserPlan.PLAN_BUSINESS: 9999,
}
UNLIMITED_PLANS = {UserPlan.PLAN_BUSINESS}


@dataclass(frozen=True)
class UsageStatus:
    plan: str
    used: int
    limit: int | None
    remaining: int | None
    is_unlimited: bool
    period: str

    def as_dict(self) -> dict:
        return {
            "plan": self.plan,
            "used": self.used,
            "limit": self.limit,
            "remaining": self.remaining,
            "is_unlimited": self.is_unlimited,
            "period": self.period,
        }


class AIUsageService:
    @staticmethod
    def current_period() -> date:
        today = timezone.localdate()
        return today.replace(day=1)

    @staticmethod
    def get_or_create_user_plan(user) -> UserPlan:
        plan, _created = UserPlan.objects.get_or_create(user=user)
        return plan

    @staticmethod
    def get_or_create_usage_record(user, period: date | None = None) -> UsageRecord:
        usage_period = period or AIUsageService.current_period()
        usage, _created = UsageRecord.objects.get_or_create(user=user, period=usage_period)
        return usage

    @staticmethod
    def get_current_usage(user) -> UsageStatus:
        user_plan = AIUsageService.get_or_create_user_plan(user)
        usage = AIUsageService.get_or_create_usage_record(user)
        is_unlimited = user_plan.plan in UNLIMITED_PLANS
        limit = None if is_unlimited else PLAN_LIMITS.get(user_plan.plan, PLAN_LIMITS[UserPlan.PLAN_FREE])
        remaining = None if is_unlimited else max(0, limit - usage.ai_generations_used)

        return UsageStatus(
            plan=user_plan.plan,
            used=usage.ai_generations_used,
            limit=limit,
            remaining=remaining,
            is_unlimited=is_unlimited,
            period=usage.period.strftime("%Y-%m"),
        )

    @staticmethod
    def can_generate(user) -> tuple[bool, UsageStatus]:
        usage_status = AIUsageService.get_current_usage(user)
        if usage_status.is_unlimited:
            return True, usage_status
        return usage_status.used < (usage_status.limit or 0), usage_status

    @staticmethod
    @transaction.atomic
    def increment_usage(user) -> UsageStatus:
        period = AIUsageService.current_period()
        usage = (
            UsageRecord.objects.select_for_update()
            .filter(user=user, period=period)
            .first()
        )
        if usage is None:
            usage = UsageRecord.objects.create(user=user, period=period)

        usage.ai_generations_used += 1
        usage.save(update_fields=["ai_generations_used", "updated_at"])
        return AIUsageService.get_current_usage(user)

    @staticmethod
    def log_action(
        *,
        user,
        action_type: str,
        status: str,
        project=None,
        prompt_version=None,
        error_message: str = "",
        token_usage: dict | None = None,
    ) -> AIUsageLog:
        token_usage = token_usage or {}
        return AIUsageLog.objects.create(
            user=user,
            project=project,
            action_type=action_type,
            status=status,
            prompt_version=prompt_version,
            error_message=error_message[:2000],
            input_tokens=token_usage.get("input_tokens"),
            output_tokens=token_usage.get("output_tokens"),
            total_tokens=token_usage.get("total_tokens"),
            # TODO: Connect provider-specific pricing once Gemini model billing rates are configured.
            estimated_cost=None,
        )


def set_user_plan(username: str, plan: str) -> UserPlan:
    if plan not in PLAN_LIMITS:
        raise ValueError(f"Unsupported plan: {plan}")

    user = get_user_model().objects.get(username=username)
    user_plan, _created = UserPlan.objects.get_or_create(user=user)
    user_plan.plan = plan
    user_plan.save(update_fields=["plan", "updated_at"])
    return user_plan
