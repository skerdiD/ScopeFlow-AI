import io
import zipfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ProposalProject, ProposalVersion


class ProposalProjectApiTests(APITestCase):
    def setUp(self):
        self.projects_url = reverse("proposal-project-list")
        self.generate_url = "/api/generate/"
        self.owner = get_user_model().objects.create_user(
            username="user-owner-123",
            email="owner@example.com",
        )
        self.other_user = get_user_model().objects.create_user(
            username="user-other-456",
            email="other@example.com",
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def _project_payload(self, **overrides):
        payload = {
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

    def test_list_projects_requires_authentication(self):
        response = self.client.get(self.projects_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_projects_returns_only_owner_projects(self):
        ProposalProject.objects.create(
            user_id=self.owner.username,
            **self._project_payload(project_name="Owner Project"),
        )
        ProposalProject.objects.create(
            user_id=self.other_user.username,
            **self._project_payload(project_name="Other Project"),
        )

        self._authenticate(self.owner)
        response = self.client.get(self.projects_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["project_name"], "Owner Project")
        self.assertEqual(response.data[0]["user_id"], self.owner.username)

    def test_create_project_uses_authenticated_owner_identity(self):
        self._authenticate(self.owner)
        response = self.client.post(
            self.projects_url,
            self._project_payload(user_id=self.other_user.username),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = ProposalProject.objects.get(id=response.data["id"])
        self.assertEqual(project.user_id, self.owner.username)
        self.assertEqual(project.generated_proposal["summary"], "A concise summary.")
        self.assertEqual(project.versions.count(), 1)
        self.assertEqual(project.versions.first().source, "manual")

    def test_create_project_validation_failure_for_missing_required_fields(self):
        self._authenticate(self.owner)
        payload = self._project_payload()
        payload.pop("client_name")

        response = self.client.post(self.projects_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("client_name", response.data)

    def test_project_detail_denies_wrong_user(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
        detail_url = reverse("proposal-project-detail", args=[project.id])

        self._authenticate(self.other_user)
        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_project_detail_denies_unauthenticated_access(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
        detail_url = reverse("proposal-project-detail", args=[project.id])

        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_project_detail_includes_version_history_for_owner(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
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
        project.current_version = version
        project.save(update_fields=["current_version", "updated_at"])

        detail_url = reverse("proposal-project-detail", args=[project.id])
        self._authenticate(self.owner)
        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["versions"]), 1)
        self.assertEqual(response.data["current_version_id"], version.id)

    def test_restore_version_requires_authentication(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
        restore_url = reverse("proposal-project-restore-version", args=[project.id])

        response = self.client.post(restore_url, {"version_id": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_restore_version_reverts_sections_for_owner(self):
        project = ProposalProject.objects.create(
            user_id=self.owner.username,
            **self._project_payload(
                summary="Current summary",
                scope="- Current scope",
                deliverables="- Current deliverable",
                milestones="Current: milestone",
                risks="- Current risk",
            ),
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

        self._authenticate(self.owner)
        restore_url = reverse("proposal-project-restore-version", args=[project.id])
        response = self.client.post(
            restore_url,
            {"version_id": version_one.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project.refresh_from_db()
        self.assertEqual(project.current_version_id, version_one.id)
        self.assertEqual(project.summary, version_one.summary)
        self.assertEqual(project.scope, version_one.scope)

    def test_restore_version_denies_wrong_user(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
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

        self._authenticate(self.other_user)
        restore_url = reverse("proposal-project-restore-version", args=[project.id])
        response = self.client.post(
            restore_url,
            {"version_id": version.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_restore_version_returns_400_when_version_id_missing(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.owner)
        restore_url = reverse("proposal-project-restore-version", args=[project.id])
        response = self.client.post(restore_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "version_id is required.")

    def test_mark_final_requires_authentication(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
        mark_final_url = reverse("proposal-project-mark-final", args=[project.id])

        response = self.client.post(mark_final_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_mark_final_sets_completed_and_creates_final_version_for_owner(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())
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

        self._authenticate(self.owner)
        mark_final_url = reverse("proposal-project-mark-final", args=[project.id])
        response = self.client.post(
            mark_final_url,
            {
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

        self.assertIsNotNone(project.current_version)
        self.assertTrue(project.current_version.is_final)
        self.assertEqual(project.current_version.label, "final")
        self.assertEqual(project.current_version.source, "final")

    def test_mark_final_denies_wrong_user(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.other_user)
        mark_final_url = reverse("proposal-project-mark-final", args=[project.id])
        response = self.client.post(mark_final_url, {"summary": "Attempted update"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_export_project_requires_authentication(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=pdf")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_export_project_pdf_returns_file_for_owner(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=pdf")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", response["Content-Type"])
        self.assertIn(".pdf", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_export_project_docx_for_selected_version(self):
        project = ProposalProject.objects.create(
            user_id=self.owner.username,
            **self._project_payload(
                summary="Current summary",
                scope="- Current scope",
                deliverables="- Current deliverable",
                milestones="Current: milestone",
                risks="- Current risk",
            ),
        )
        version = ProposalVersion.objects.create(
            project=project,
            version_number=1,
            label="v1",
            source="manual",
            changed_sections=["summary"],
            summary="Versioned summary for export",
            scope="- Version scope item",
            deliverables="- Version deliverable item",
            milestones="Milestone A: Version-specific milestone",
            risks="- Version risk",
        )

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=docx&version_id={version.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            response["Content-Type"],
        )
        self.assertIn(".docx", response["Content-Disposition"])
        self.assertTrue(response.content.startswith(b"PK"))

        archive = zipfile.ZipFile(io.BytesIO(response.content))
        xml_content = archive.read("word/document.xml").decode("utf-8")
        self.assertIn("Versioned summary for export", xml_content)

    def test_export_project_supports_final_version_selector(self):
        project = ProposalProject.objects.create(
            user_id=self.owner.username,
            **self._project_payload(summary="Current summary that should not be exported"),
        )
        ProposalVersion.objects.create(
            project=project,
            version_number=1,
            label="final",
            source="final",
            changed_sections=["summary"],
            summary="Final summary for client export",
            scope="- Final scope item",
            deliverables="- Final deliverable",
            milestones="Launch: Final delivery checkpoint",
            risks="- Final risk",
            is_final=True,
        )

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=docx&final_version=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        archive = zipfile.ZipFile(io.BytesIO(response.content))
        xml_content = archive.read("word/document.xml").decode("utf-8")
        self.assertIn("Final summary for client export", xml_content)
        self.assertNotIn("Current summary that should not be exported", xml_content)

    def test_export_project_invalid_format_returns_400(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=txt")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "file_type must be either 'pdf' or 'docx'.")

    def test_export_project_invalid_version_id_returns_400(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=pdf&version_id=abc")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "version_id must be a numeric value.")

    def test_export_project_returns_404_for_missing_version(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=pdf&version_id=999999")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_export_project_returns_404_for_missing_final_version(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.owner)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=pdf&final_version=true")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["detail"], "Final version not found for this project.")

    def test_export_project_denies_wrong_user(self):
        project = ProposalProject.objects.create(user_id=self.owner.username, **self._project_payload())

        self._authenticate(self.other_user)
        response = self.client.get(f"/api/projects/{project.id}/export/?file_type=pdf")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch("proposals.views.generate_structured_proposal")
    def test_generate_endpoint_creates_owner_project(self, mock_generate_structured_proposal):
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

        self._authenticate(self.owner)
        response = self.client.post(self.generate_url, self._generate_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_generate_structured_proposal.assert_called_once()

        project = ProposalProject.objects.get(id=response.data["id"])
        self.assertEqual(project.user_id, self.owner.username)
        self.assertEqual(project.status, "in_review")
        self.assertEqual(project.versions.count(), 1)
        self.assertEqual(project.versions.first().source, "generate")

    def test_generate_endpoint_requires_authentication(self):
        response = self.client.post(self.generate_url, self._generate_payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_generate_endpoint_returns_400_for_missing_required_fields(self):
        self._authenticate(self.owner)
        required_field_cases = [
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
