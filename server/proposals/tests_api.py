from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ProposalProject, ProposalVersion


class ProposalProjectApiTests(APITestCase):
    def setUp(self):
        self.projects_url = reverse("proposal-project-list")
        self.generate_url = "/api/generate/"

    def _project_payload(self, **overrides):
        payload = {
            "user_id": "user-alpha",
            "client_name": "Acme Corp",
            "project_name": "Acme Website Revamp",
            "project_type": "Web Design",
            "budget": "$10,000 - $25,000",
            "timeline": "2-3 months",
            "requirements": "Improve UX and conversion.",
            "summary": "A concise summary.",
            "scope": "- Discovery\n- Design\n- Build",
            "deliverables": "- Wireframes\n- UI kit\n- Responsive pages",
            "milestones": "Discovery: Plan and alignment\nBuild: Delivery and QA",
            "risks": "- Delayed feedback",
            "missing_information": ["Final content"],
            "scope_risks": ["Scope creep"],
            "unclear_requirements": ["Analytics depth"],
            "suggested_questions": ["Who approves design?"],
            "status": "draft",
        }
        payload.update(overrides)
        return payload

    def _generate_payload(self, **overrides):
        payload = {
            "user_id": "user-alpha",
            "client_name": "Acme Corp",
            "business_type": "SaaS",
            "project_goals": "Increase signup conversion.",
            "required_features": "Onboarding flow, analytics dashboard",
            "budget_range": "$10,000 - $25,000",
            "timeline": "2-3 months",
            "call_notes": "Prioritize first-week activation.",
        }
        payload.update(overrides)
        return payload

    def test_create_project_persists_generated_snapshot_and_initial_version(self):
        response = self.client.post(self.projects_url, self._project_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = ProposalProject.objects.get(id=response.data["id"])

        self.assertEqual(project.user_id, "user-alpha")
        self.assertEqual(project.generated_proposal["summary"], "A concise summary.")
        self.assertEqual(project.generated_proposal["scope_of_work"], ["Discovery", "Design", "Build"])
        self.assertIsNotNone(project.current_version_id)
        self.assertEqual(project.versions.count(), 1)
        self.assertEqual(project.versions.first().source, "manual")

    def test_list_projects_returns_all_without_filter(self):
        ProposalProject.objects.create(**self._project_payload(user_id="user-a", project_name="Project A"))
        ProposalProject.objects.create(**self._project_payload(user_id="user-b", project_name="Project B"))

        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_list_projects_filters_by_user_id(self):
        ProposalProject.objects.create(**self._project_payload(user_id="user-a", project_name="Project A"))
        ProposalProject.objects.create(**self._project_payload(user_id="user-b", project_name="Project B"))

        response = self.client.get(self.projects_url, {"user_id": "user-a"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user_id"], "user-a")

    def test_create_project_returns_400_for_missing_required_fields(self):
        payload = self._project_payload()
        payload.pop("client_name")

        response = self.client.post(self.projects_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("client_name", response.data)

    def test_retrieve_project_returns_404_for_wrong_user_filter(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a"))
        detail_url = reverse("proposal-project-detail", args=[project.id])

        response = self.client.get(detail_url, {"user_id": "user-b"})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_restore_version_reverts_sections_and_sets_current_version(self):
        project = ProposalProject.objects.create(
            **self._project_payload(
                user_id="user-a",
                summary="Current summary",
                scope="- Current scope",
                deliverables="- Current deliverable",
                milestones="Current: milestone",
                risks="- Current risk",
            )
        )
        version_one = ProposalVersion.objects.create(
            project=project,
            version_number=1,
            label="v1",
            source="manual",
            changed_sections=["summary"],
            summary="Original summary",
            scope="- Original scope",
            deliverables="- Original deliverable",
            milestones="Original: milestone",
            risks="- Original risk",
        )
        version_two = ProposalVersion.objects.create(
            project=project,
            version_number=2,
            label="v2",
            source="manual",
            changed_sections=["summary"],
            summary="Current summary",
            scope="- Current scope",
            deliverables="- Current deliverable",
            milestones="Current: milestone",
            risks="- Current risk",
        )
        project.current_version = version_two
        project.save(update_fields=["current_version", "updated_at"])

        restore_url = reverse("proposal-project-restore-version", args=[project.id])
        response = self.client.post(
            restore_url,
            {"user_id": "user-a", "version_id": version_one.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project.refresh_from_db()
        self.assertEqual(project.current_version_id, version_one.id)
        self.assertEqual(project.summary, version_one.summary)
        self.assertEqual(project.scope, version_one.scope)
        self.assertEqual(project.generated_proposal["summary"], version_one.summary)

    def test_restore_version_returns_400_for_missing_required_fields(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a"))
        restore_url = reverse("proposal-project-restore-version", args=[project.id])

        response = self.client.post(restore_url, {"user_id": "user-a"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "user_id and version_id are required.")

    def test_restore_version_returns_404_for_wrong_user(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a"))
        version = ProposalVersion.objects.create(
            project=project,
            version_number=1,
            label="v1",
            source="manual",
            changed_sections=["summary"],
            summary="Original summary",
            scope="- Original scope",
            deliverables="- Original deliverable",
            milestones="Original: milestone",
            risks="- Original risk",
        )
        restore_url = reverse("proposal-project-restore-version", args=[project.id])

        response = self.client.post(
            restore_url,
            {"user_id": "user-b", "version_id": version.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_restore_version_returns_404_for_invalid_version_id(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a"))
        restore_url = reverse("proposal-project-restore-version", args=[project.id])

        response = self.client.post(
            restore_url,
            {"user_id": "user-a", "version_id": 999999},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_final_sets_completed_and_creates_new_final_version(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a", summary="Initial summary"))
        previous_final = ProposalVersion.objects.create(
            project=project,
            version_number=1,
            label="final",
            source="final",
            changed_sections=["summary"],
            summary="Older final summary",
            scope="- Older final scope",
            deliverables="- Older final deliverables",
            milestones="Older: milestone",
            risks="- Older final risk",
            is_final=True,
        )
        project.current_version = previous_final
        project.save(update_fields=["current_version", "updated_at"])

        mark_final_url = reverse("proposal-project-mark-final", args=[project.id])
        response = self.client.post(
            mark_final_url,
            {
                "user_id": "user-a",
                "summary": "Latest final summary",
                "scope": "- Latest final scope",
                "deliverables": "- Latest final deliverables",
                "milestones": "Latest: milestone",
                "risks": "- Latest final risk",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project.refresh_from_db()
        self.assertEqual(project.status, "completed")
        self.assertEqual(project.versions.count(), 2)

        previous_final.refresh_from_db()
        self.assertFalse(previous_final.is_final)
        self.assertEqual(previous_final.label, "v1")

        current = project.current_version
        self.assertIsNotNone(current)
        self.assertTrue(current.is_final)
        self.assertEqual(current.label, "final")
        self.assertEqual(current.source, "final")
        self.assertEqual(current.summary, "Latest final summary")

    def test_mark_final_returns_400_for_missing_user_id(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a"))
        mark_final_url = reverse("proposal-project-mark-final", args=[project.id])

        response = self.client.post(mark_final_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "user_id is required.")

    def test_mark_final_returns_404_for_wrong_user(self):
        project = ProposalProject.objects.create(**self._project_payload(user_id="user-a"))
        mark_final_url = reverse("proposal-project-mark-final", args=[project.id])

        response = self.client.post(mark_final_url, {"user_id": "user-b"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_final_returns_404_for_invalid_project_id(self):
        mark_final_url = reverse("proposal-project-mark-final", args=[999999])

        response = self.client.post(mark_final_url, {"user_id": "user-a"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("proposals.views.generate_structured_proposal")
    def test_generate_endpoint_creates_project_and_generate_version(self, mock_generate_structured_proposal):
        mock_generate_structured_proposal.return_value = {
            "summary": "Generated summary",
            "scope_of_work": ["Discovery", "Build", "QA", "Launch"],
            "deliverables": [
                "Scope plan",
                "Core implementation",
                "QA checklist",
                "Launch handover",
                "Post-launch notes",
            ],
            "milestones": [
                {"title": "Discovery", "description": "Confirm requirements and architecture."},
                {"title": "Build", "description": "Implement and review core features."},
                {"title": "Launch", "description": "Deploy and hand over."},
            ],
            "risks": ["Scope changes", "Feedback delays"],
        }

        response = self.client.post(self.generate_url, self._generate_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_generate_structured_proposal.assert_called_once()

        project = ProposalProject.objects.get(id=response.data["id"])
        self.assertEqual(project.status, "in_review")
        self.assertEqual(project.summary, "Generated summary")
        self.assertEqual(project.versions.count(), 1)
        self.assertEqual(project.versions.first().source, "generate")

    def test_generate_endpoint_returns_400_for_missing_required_fields(self):
        required_field_cases = [
            ("user_id", "user_id is required."),
            ("client_name", "client_name is required."),
            ("project_goals", "project_goals is required."),
        ]

        for missing_field, expected_message in required_field_cases:
            with self.subTest(missing_field=missing_field):
                payload = self._generate_payload()
                payload.pop(missing_field)

                response = self.client.post(self.generate_url, payload, format="json")

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(response.data["detail"], expected_message)

