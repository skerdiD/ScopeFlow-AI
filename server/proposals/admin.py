from django.contrib import admin
from .models import ProposalProject


@admin.register(ProposalProject)
class ProposalProjectAdmin(admin.ModelAdmin):
    list_display = ("project_name", "client_name", "project_type", "status", "updated_at")
    search_fields = ("project_name", "client_name", "project_type", "user_id")
    list_filter = ("status", "project_type")