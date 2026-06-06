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


class AIPromptVersion(models.Model):
    PURPOSE_FULL_PROPOSAL = "full_proposal"
    PURPOSE_SECTION_REGENERATION = "section_regeneration"
    PURPOSE_QUALITY_REVIEW = "quality_review"
    PURPOSE_EDIT_SUGGESTIONS = "edit_suggestions"

    PURPOSE_CHOICES = [
        (PURPOSE_FULL_PROPOSAL, "Full Proposal"),
        (PURPOSE_SECTION_REGENERATION, "Section Regeneration"),
        (PURPOSE_QUALITY_REVIEW, "Quality Review"),
        (PURPOSE_EDIT_SUGGESTIONS, "Edit Suggestions"),
    ]

    name = models.CharField(max_length=120)
    version = models.CharField(max_length=50)
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, db_index=True)
    prompt_text = models.TextField()
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["purpose", "-is_active", "-updated_at"]
        constraints = [
            models.UniqueConstraint(fields=["purpose", "version"], name="unique_prompt_purpose_version"),
        ]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_active:
            AIPromptVersion.objects.filter(purpose=self.purpose, is_active=True).exclude(id=self.id).update(
                is_active=False
            )

    def __str__(self):
        return f"{self.name} ({self.purpose}:{self.version})"


class ProposalProject(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("sent", "Sent"),
        ("viewed", "Viewed"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
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
    proposal_timeline = models.TextField(blank=True)
    pricing = models.TextField(blank=True)
    risks = models.TextField(blank=True)
    next_steps = models.TextField(blank=True)
    payment_url = models.URLField(blank=True)
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
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True)
    share_enabled = models.BooleanField(default=False)
    share_created_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    client_name_response = models.CharField(max_length=255, blank=True)
    client_email_response = models.EmailField(blank=True)
    client_response_comment = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    is_demo = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user_id", "updated_at"], name="proposal_user_updated_idx"),
        ]

    def __str__(self):
        return self.project_name


class ProposalClientComment(models.Model):
    project = models.ForeignKey(ProposalProject, related_name="client_comments", on_delete=models.CASCADE)
    client_name = models.CharField(max_length=255, blank=True)
    client_email = models.EmailField(blank=True)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.project.project_name} - client comment"


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
    proposal_timeline = models.TextField(blank=True)
    pricing = models.TextField(blank=True)
    risks = models.TextField(blank=True)
    next_steps = models.TextField(blank=True)
    is_final = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "is_final", "created_at"], name="proposal_ver_export_idx"),
        ]

    def __str__(self):
        return f"{self.project.project_name} - {self.label}"


class AIUsageLog(models.Model):
    ACTION_FULL_PROPOSAL = "full_proposal_generation"
    ACTION_SECTION_REGENERATION = "section_regeneration"
    ACTION_QUALITY_SCORE = "quality_score"
    ACTION_EDIT_SUGGESTIONS = "edit_suggestions"

    ACTION_CHOICES = [
        (ACTION_FULL_PROPOSAL, "Full Proposal Generation"),
        (ACTION_SECTION_REGENERATION, "Section Regeneration"),
        (ACTION_QUALITY_SCORE, "Quality Score"),
        (ACTION_EDIT_SUGGESTIONS, "Edit Suggestions"),
    ]

    STATUS_SUCCESS = "success"
    STATUS_FAILURE = "failure"

    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILURE, "Failure"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="ai_usage_logs", on_delete=models.CASCADE)
    project = models.ForeignKey(
        ProposalProject,
        related_name="ai_usage_logs",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    action_type = models.CharField(max_length=50, choices=ACTION_CHOICES, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, db_index=True)
    prompt_version = models.ForeignKey(
        AIPromptVersion,
        related_name="usage_logs",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    error_message = models.TextField(blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    total_tokens = models.PositiveIntegerField(null=True, blank=True)
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"], name="ai_usage_user_created_idx"),
            models.Index(fields=["action_type", "created_at"], name="ai_usage_action_created_idx"),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.action_type} - {self.status}"


class AIQualityReview(models.Model):
    project = models.ForeignKey(ProposalProject, related_name="quality_reviews", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="quality_reviews", on_delete=models.CASCADE)
    proposal_version = models.ForeignKey(
        ProposalVersion,
        related_name="quality_reviews",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    score = models.PositiveSmallIntegerField()
    summary = models.TextField()
    strengths = models.JSONField(default=list, blank=True)
    weaknesses = models.JSONField(default=list, blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    prompt_version = models.ForeignKey(
        AIPromptVersion,
        related_name="quality_reviews",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "created_at"], name="ai_review_project_created_idx"),
        ]

    def __str__(self):
        return f"{self.project.project_name} - {self.score}/100"
