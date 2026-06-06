from io import StringIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from unittest.mock import patch

from .authentication import SupabaseTokenAuthentication
from .demo import DEMO_EMAIL, ensure_demo_workspace
from .models import ProposalProject, UsageRecord, UserPlan
from .services.usage_service import AIUsageService


class DemoSeedCommandTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username="demo-seed-demo", email=DEMO_EMAIL)

    def run_seed(self, *args):
        call_command("seed_demo_data", *args, stdout=StringIO())

    def test_seed_is_idempotent(self):
        self.run_seed()
        first_project_count = ProposalProject.objects.filter(user_id=self.user.username, is_demo=True).count()
        first_version_count = sum(
            project.versions.count()
            for project in ProposalProject.objects.filter(user_id=self.user.username, is_demo=True)
        )

        self.run_seed()

        self.assertEqual(first_project_count, 10)
        self.assertEqual(ProposalProject.objects.filter(user_id=self.user.username, is_demo=True).count(), 10)
        self.assertEqual(
            sum(project.versions.count() for project in ProposalProject.objects.filter(user_id=self.user.username, is_demo=True)),
            first_version_count,
        )

    def test_reset_preserves_non_demo_and_other_user_projects(self):
        other_user = get_user_model().objects.create_user(username="other-user", email="other@example.com")
        own_non_demo = ProposalProject.objects.create(
            user_id=self.user.username,
            client_name="Personal",
            project_name="Keep my project",
            project_type="Web",
        )
        other_demo_flagged = ProposalProject.objects.create(
            user_id=other_user.username,
            client_name="Other",
            project_name="Other user's demo project",
            project_type="Web",
            is_demo=True,
        )

        self.run_seed("--reset")

        self.assertTrue(ProposalProject.objects.filter(pk=own_non_demo.pk).exists())
        self.assertTrue(ProposalProject.objects.filter(pk=other_demo_flagged.pk).exists())
        self.assertEqual(ProposalProject.objects.filter(user_id=self.user.username, is_demo=True).count(), 10)

    def test_supabase_demo_identity_reuses_seeded_local_user(self):
        mapped = SupabaseTokenAuthentication()._get_or_create_user(
            supabase_user_id="supabase-demo-uuid",
            email=DEMO_EMAIL,
        )

        self.assertEqual(mapped.pk, self.user.pk)
        self.assertFalse(get_user_model().objects.filter(username="supabase-demo-uuid").exists())

    def test_demo_workspace_self_heals_when_seed_is_missing(self):
        ensure_demo_workspace(self.user)

        self.assertEqual(ProposalProject.objects.filter(user_id=self.user.username, is_demo=True).count(), 10)
        self.assertEqual(UserPlan.objects.get(user=self.user).plan, UserPlan.PLAN_PRO)
        self.assertTrue(
            UsageRecord.objects.filter(user=self.user, period=AIUsageService.current_period()).exists()
        )

    def test_demo_workspace_self_heals_incomplete_seed(self):
        self.run_seed()
        ProposalProject.objects.filter(user_id=self.user.username, is_demo=True).first().delete()

        ensure_demo_workspace(self.user)

        self.assertEqual(ProposalProject.objects.filter(user_id=self.user.username, is_demo=True).count(), 10)

    def test_verified_demo_workspace_skips_repeated_database_checks(self):
        self.run_seed()
        ensure_demo_workspace(self.user)

        with patch("django.db.transaction.atomic") as atomic:
            ensure_demo_workspace(self.user)

        atomic.assert_not_called()
