from django.test import TestCase

# Create your tests here.
from unittest.mock import Mock, patch

from django.test import TestCase

from .services.gemini_service import (
    GeminiApiKeyLeakedError,
    GeminiApiKeyMissingError,
    GeminiQuotaExceededError,
    generate_structured_proposal,
    normalize_generated_proposal,
)


class GeminiServiceTests(TestCase):
    def test_normalize_generated_proposal_success(self):
        normalized = normalize_generated_proposal(
            {
                "summary": "Build a polished ecommerce platform for client growth.",
                "scope_of_work": ["Discovery", "UX/UI design", "Storefront build", "Checkout flow"],
                "deliverables": [
                    "UX wireframes",
                    "Visual UI system",
                    "Product catalog module",
                    "Checkout integration",
                    "Admin dashboard",
                ],
                "milestones": [
                    {"title": "Discovery", "description": "Finalize requirements and architecture."},
                    {"title": "Build", "description": "Implement core ecommerce features."},
                    {"title": "Launch", "description": "QA, deploy, and handover."},
                ],
                "risks": [
                    "Scope expansion may impact delivery dates.",
                    "Delayed client feedback may slow milestone approvals.",
                ],
            }
        )

        self.assertIn("summary", normalized)
        self.assertEqual(len(normalized["scope_of_work"]), 4)
        self.assertEqual(len(normalized["deliverables"]), 5)
        self.assertEqual(len(normalized["milestones"]), 3)
        self.assertEqual(len(normalized["risks"]), 2)

    def test_normalize_generated_proposal_adds_fallback_risks(self):
        normalized = normalize_generated_proposal(
            {
                "summary": "Build and launch an ecommerce storefront for online sales.",
                "scope_of_work": ["Discovery", "UX/UI design", "Storefront build", "Checkout flow"],
                "deliverables": [
                    "UX wireframes",
                    "Visual UI system",
                    "Product catalog module",
                    "Checkout integration",
                    "Admin dashboard",
                ],
                "milestones": [
                    {"title": "Discovery", "description": "Finalize requirements and architecture."},
                    {"title": "Build", "description": "Implement core ecommerce features."},
                    {"title": "Launch", "description": "QA, deploy, and handover."},
                ],
                "risks": [],
            },
            intake={
                "client_name": "Acme",
                "business_type": "Ecommerce",
                "project_goals": "Increase online sales",
                "required_features": "Catalog, cart, checkout",
                "budget_range": "$10,000 - $25,000",
                "timeline": "2-3 months",
                "call_notes": "Priority on conversion optimization",
            },
        )

        self.assertGreaterEqual(len(normalized["risks"]), 2)

    @patch("proposals.services.gemini_service.requests.post")
    @patch("proposals.services.gemini_service.os.getenv")
    def test_generate_structured_proposal_missing_key(self, mock_getenv: Mock, _mock_post: Mock):
        def getenv_side_effect(name: str, default: str = ""):
            if name == "GEMINI_API_KEY":
                return ""
            return default

        mock_getenv.side_effect = getenv_side_effect

        with self.assertRaises(GeminiApiKeyMissingError):
            generate_structured_proposal(
                {
                    "client_name": "Acme",
                    "business_type": "Ecommerce",
                    "project_goals": "Increase online sales",
                    "required_features": "Catalog, cart, checkout",
                    "budget_range": "$10,000 - $25,000",
                    "timeline": "2-3 months",
                    "call_notes": "Priority on conversion optimization",
                }
            )

    @patch("proposals.services.gemini_service.requests.post")
    @patch("proposals.services.gemini_service.os.getenv")
    def test_generate_structured_proposal_quota_error(self, mock_getenv: Mock, mock_post: Mock):
        def getenv_side_effect(name: str, default: str = ""):
            if name == "GEMINI_API_KEY":
                return "test-key"
            return default

        mock_getenv.side_effect = getenv_side_effect

        response = Mock()
        response.ok = False
        response.status_code = 429
        response.json.return_value = {
            "error": {"message": "Quota exceeded for metric generate_content_free_tier_input_token_count"}
        }
        response.text = ""
        mock_post.return_value = response

        with self.assertRaises(GeminiQuotaExceededError):
            generate_structured_proposal(
                {
                    "client_name": "Acme",
                    "business_type": "Ecommerce",
                    "project_goals": "Increase online sales",
                    "required_features": "Catalog, cart, checkout",
                    "budget_range": "$10,000 - $25,000",
                    "timeline": "2-3 months",
                    "call_notes": "Priority on conversion optimization",
                }
            )

    @patch("proposals.services.gemini_service.requests.post")
    @patch("proposals.services.gemini_service.os.getenv")
    def test_generate_structured_proposal_leaked_key_error(self, mock_getenv: Mock, mock_post: Mock):
        def getenv_side_effect(name: str, default: str = ""):
            if name == "GEMINI_API_KEY":
                return "test-key"
            return default

        mock_getenv.side_effect = getenv_side_effect

        response = Mock()
        response.ok = False
        response.status_code = 403
        response.json.return_value = {"error": {"message": "Your API key was reported as leaked."}}
        response.text = ""
        mock_post.return_value = response

        with self.assertRaises(GeminiApiKeyLeakedError):
            generate_structured_proposal(
                {
                    "client_name": "Acme",
                    "business_type": "Ecommerce",
                    "project_goals": "Increase online sales",
                    "required_features": "Catalog, cart, checkout",
                    "budget_range": "$10,000 - $25,000",
                    "timeline": "2-3 months",
                    "call_notes": "Priority on conversion optimization",
                }
            )
