from django.contrib import admin
from .models import ProposalProject, UsageRecord, UserPlan


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
