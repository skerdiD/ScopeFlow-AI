from django.db import models


class ProposalProject(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("in_review", "In Review"),
        ("completed", "Completed"),
    ]

    user_id = models.CharField(max_length=255)
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
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.project_name