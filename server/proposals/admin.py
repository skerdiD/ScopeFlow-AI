from django.contrib import admin
from .models import AIQualityReview, AIPromptVersion, AIUsageLog, ProposalProject, UsageRecord, UserPlan


@admin.register(ProposalProject)
class ProposalProjectAdmin(admin.ModelAdmin):
    list_display = ("project_name", "client_name", "project_type", "status", "updated_at")
    search_fields = ("project_name", "client_name", "project_type", "user_id")
    list_filter = ("status", "project_type")


@admin.register(UserPlan)
class UserPlanAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "updated_at")
    search_fields = ("user__username", "user__email")
    list_filter = ("plan",)


@admin.register(UsageRecord)
class UsageRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "period", "ai_generations_used", "updated_at")
    search_fields = ("user__username", "user__email")
    list_filter = ("period",)


@admin.register(AIPromptVersion)
class AIPromptVersionAdmin(admin.ModelAdmin):
    list_display = ("name", "purpose", "version", "is_active", "updated_at")
    search_fields = ("name", "version", "prompt_text")
    list_filter = ("purpose", "is_active")


@admin.register(AIUsageLog)
class AIUsageLogAdmin(admin.ModelAdmin):
    list_display = ("user", "project", "action_type", "status", "prompt_version", "total_tokens", "created_at")
    search_fields = ("user__username", "user__email", "project__project_name", "error_message")
    list_filter = ("action_type", "status", "created_at")
    readonly_fields = ("created_at",)


@admin.register(AIQualityReview)
class AIQualityReviewAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "score", "created_at")
    search_fields = ("project__project_name", "user__username", "summary")
    list_filter = ("score", "created_at")
