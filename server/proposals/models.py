from django.conf import settings
from django.db import models


class UserPlan(models.Model):
    PLAN_FREE = "free"
    PLAN_PRO = "pro"
    PLAN_BUSINESS = "business"

    PLAN_CHOICES = [
        (PLAN_FREE, "Free"),
        (PLAN_PRO, "Pro"),
        (PLAN_BUSINESS, "Business"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, related_name="plan", on_delete=models.CASCADE)
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default=PLAN_FREE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.plan}"


class UsageRecord(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="usage_records", on_delete=models.CASCADE)
    period = models.DateField(db_index=True)
    ai_generations_used = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "period"], name="unique_user_usage_period"),
        ]
        indexes = [
            models.Index(fields=["user", "period"], name="usage_user_period_idx"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.period:%Y-%m} - {self.ai_generations_used}"


class ProposalProject(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("in_review", "In Review"),
        ("completed", "Completed"),
    ]

    user_id = models.CharField(max_length=255, db_index=True)
    client_name = models.CharField(max_length=255)
    project_name = models.CharField(max_length=255)
    project_type = models.CharField(max_length=120)
    budget = models.CharField(max_length=120, blank=True)
    timeline = models.CharField(max_length=120, blank=True)
    requirements = models.TextField(blank=True)
    summary = models.TextField(blank=True)
    scope = models.TextField(blank=True)
    deliverables = models.TextField(blank=True)
    milestones = models.TextField(blank=True)
    risks = models.TextField(blank=True)
    missing_information = models.JSONField(default=list, blank=True)
    scope_risks = models.JSONField(default=list, blank=True)
    unclear_requirements = models.JSONField(default=list, blank=True)
    suggested_questions = models.JSONField(default=list, blank=True)
    generated_proposal = models.JSONField(default=dict, blank=True)
    current_version = models.ForeignKey(
        "ProposalVersion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user_id", "updated_at"], name="proposal_user_updated_idx"),
        ]

    def __str__(self):
        return self.project_name


class ProposalVersion(models.Model):
    SOURCE_CHOICES = [
        ("manual", "Manual"),
        ("generate", "Generate"),
        ("regenerate", "Regenerate"),
        ("final", "Final"),
    ]

    project = models.ForeignKey(
        ProposalProject,
        related_name="versions",
        on_delete=models.CASCADE,
    )
    version_number = models.PositiveIntegerField()
    label = models.CharField(max_length=50)
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES, default="manual")
    changed_sections = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True)
    scope = models.TextField(blank=True)
    deliverables = models.TextField(blank=True)
    milestones = models.TextField(blank=True)
    risks = models.TextField(blank=True)
    is_final = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "is_final", "created_at"], name="proposal_ver_export_idx"),
        ]

    def __str__(self):
        return f"{self.project.project_name} - {self.label}"
