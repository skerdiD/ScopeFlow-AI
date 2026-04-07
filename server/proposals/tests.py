from unittest.mock import Mock, patch

from django.test import TestCase

from .services.gemini_service import (
    GeminiApiKeyLeakedError,
    GeminiApiKeyMissingError,
    GeminiApiResponseError,
    GeminiQuotaExceededError,
    _clean_json_text,
    generate_template_draft,
    generate_structured_proposal,
    normalize_generated_proposal,
)


class GeminiServiceTests(TestCase):
    def test_clean_json_text_extracts_object_from_wrapped_response(self):
        raw = '```json\n{"name":"SEO Template","category":"SEO"}\n```\nAdditional notes here.'
        parsed = _clean_json_text(raw)

        self.assertEqual(parsed["name"], "SEO Template")
        self.assertEqual(parsed["category"], "SEO")

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

    @patch("proposals.services.gemini_service._call_gemini_json_response")
    def test_generate_structured_proposal_fallback_on_invalid_json(self, mock_call: Mock):
        mock_call.side_effect = GeminiApiResponseError("Gemini returned invalid JSON.")

        generated = generate_structured_proposal(
            {
                "client_name": "Acme",
                "business_type": "SaaS",
                "project_goals": "Improve onboarding conversion and reduce churn",
                "required_features": "Onboarding flow, activation emails, analytics dashboard",
                "budget_range": "$10,000 - $25,000",
                "timeline": "2-3 months",
                "call_notes": "Focus on first-week activation",
            }
        )

        self.assertTrue(generated["summary"])
        self.assertGreaterEqual(len(generated["scope_of_work"]), 4)
        self.assertGreaterEqual(len(generated["deliverables"]), 5)
        self.assertGreaterEqual(len(generated["milestones"]), 3)
        self.assertGreaterEqual(len(generated["risks"]), 2)

    @patch("proposals.services.gemini_service._call_gemini_json_response")
    def test_generate_template_draft_fallback_on_invalid_json(self, mock_call: Mock):
        mock_call.side_effect = GeminiApiResponseError("Gemini returned invalid JSON.")

        draft = generate_template_draft("SEO", existing_categories=["SEO", "Marketing"])

        self.assertTrue(draft["name"])
        self.assertTrue(draft["description"])
        self.assertIn(draft["category"], ["SEO", "Marketing", "Web Design"])
        self.assertTrue(draft["sections"]["summary"]["included"])
        self.assertTrue(draft["sections"]["summary"]["content"])

    @patch("proposals.services.gemini_service._call_gemini_json_response")
    def test_generate_template_draft_fallback_on_missing_key(self, mock_call: Mock):
        mock_call.side_effect = GeminiApiKeyMissingError("GEMINI_API_KEY is missing.")

        draft = generate_template_draft("SaaS onboarding", existing_categories=["SaaS", "Web Design"])

        self.assertTrue(draft["name"])
        self.assertTrue(draft["description"])
        self.assertTrue(draft["category"])
        self.assertTrue(draft["sections"]["scope"]["content"])
