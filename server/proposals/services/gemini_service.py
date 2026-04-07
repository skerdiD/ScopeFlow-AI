import json
import os
from typing import Any

import requests


DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiServiceError(Exception):
    pass


class GeminiApiKeyMissingError(GeminiServiceError):
    pass


class GeminiApiRequestError(GeminiServiceError):
    pass


class GeminiApiResponseError(GeminiServiceError):
    pass


class GeminiQuotaExceededError(GeminiApiRequestError):
    pass


class GeminiApiKeyLeakedError(GeminiApiRequestError):
    pass


def _build_prompt(intake: dict[str, str]) -> str:
    schema = {
        "summary": "string",
        "scope_of_work": ["string"],
        "deliverables": ["string"],
        "milestones": [{"title": "string", "description": "string"}],
        "risks": ["string"],
    }

    client_name = intake.get("client_name", "").strip() or "the client"
    business_type = intake.get("business_type", "").strip()
    project_goals = intake.get("project_goals", "").strip()
    required_features = intake.get("required_features", "").strip()
    budget_range = intake.get("budget_range", "").strip()
    timeline = intake.get("timeline", "").strip()
    call_notes = intake.get("call_notes", "").strip()

    return f"""
You are a senior digital agency strategist writing a proposal for {client_name}.
Rewrite rough intake notes into a concise, client-ready proposal.
Write like a sharp freelancer or agency lead: practical, clear, and commercially aware.
The result should feel 20-35% shorter than typical AI consultancy output while keeping useful detail.

Return valid JSON only. No markdown. No code fences. No commentary.

Required JSON shape:
{json.dumps(schema)}

Content rules:
- summary:
  - Exactly one short paragraph.
  - State what will be built, expected outcome, and timeline context.
  - Keep it tight and client-facing. No inflated strategy language.
- scope_of_work:
  - 4 to 8 items.
  - Each item should be a concrete workstream.
  - Keep bullets concise and specific to provided requirements.
- deliverables:
  - 5 to 8 realistic outputs the client will actually receive.
  - Keep deliverables tangible and client-facing.
  - Avoid generic boilerplate that could fit any project.
- milestones:
  - 3 to 5 milestones in logical sequence from discovery to launch/handover.
  - Titles must be short and actionable.
  - Descriptions should be brief and outcome-focused.
- risks:
  - 2 to 4 practical risks/assumptions.
  - Keep each risk concise and specific to likely delivery constraints.
  - Typical risk themes: scope expansion, delayed feedback, unclear requirements, third-party dependency delays.
  - Never return an empty risks list.

Writing quality rules:
- Use modern, direct business language.
- Keep sentences short to medium length and easy to scan.
- Avoid repetitive phrases and generic filler.
- Avoid buzzword-heavy claims and empty qualifiers.
- Do not use phrases like: "robust foundation", "accelerate your market entry", "operational stability post-launch", "comprehensive professional proposal draft".
- If input is rough, improve clarity while preserving intent.
- Do not invent constraints, integrations, or legal commitments that were not implied by the intake.
- Keep wording concise, believable, and tailored to this project.
- Do not repeat the same idea across sections.

Project intake:
- Client name: {client_name}
- Business type: {business_type}
- Project goals: {project_goals}
- Required features: {required_features}
- Budget range: {budget_range}
- Timeline: {timeline}
- Call notes: {call_notes}

Grounding hints:
- If budget or timeline is provided, reflect realistic prioritization and phasing.
- If required features are listed, map scope and deliverables directly to those features.
- If call notes are sparse, infer sensible professional wording but stay conservative.
""".strip()


def _clean_json_text(raw_text: str) -> dict[str, Any]:
    text = raw_text.strip()
    if not text:
        raise GeminiApiResponseError("Gemini returned invalid JSON.")
    smart_quote_translation = str.maketrans(
        {
            "\u201c": '"',
            "\u201d": '"',
            "\u2018": "'",
            "\u2019": "'",
        }
    )

    def extract_first_json_object(value: str) -> str:
        start = value.find("{")
        if start == -1:
            return ""

        depth = 0
        in_string = False
        escaped = False

        for index in range(start, len(value)):
            char = value[index]

            if in_string:
                if escaped:
                    escaped = False
                    continue
                if char == "\\":
                    escaped = True
                    continue
                if char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
                continue
            if char == "{":
                depth += 1
                continue
            if char == "}":
                depth -= 1
                if depth == 0:
                    return value[start : index + 1]

        return ""

    def parse_as_object(candidate: str) -> dict[str, Any] | None:
        normalized_candidate = candidate.strip()
        if not normalized_candidate:
            return None

        parsed = json.loads(normalized_candidate)
        if isinstance(parsed, dict):
            return parsed
        if isinstance(parsed, list):
            for item in parsed:
                if isinstance(item, dict):
                    return item
        return None

    candidates: list[str] = [text]

    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            stripped_code_fence = "\n".join(lines[1:-1]).strip()
            if stripped_code_fence:
                candidates.append(stripped_code_fence)

    first_object = extract_first_json_object(text)
    if first_object:
        candidates.append(first_object)

    seen_candidates: set[str] = set()
    unique_candidates: list[str] = []
    for candidate in candidates:
        normalized_candidate = candidate.strip()
        if not normalized_candidate or normalized_candidate in seen_candidates:
            continue
        seen_candidates.add(normalized_candidate)
        unique_candidates.append(normalized_candidate)

    for candidate in unique_candidates:
        parse_attempts = [
            candidate,
            candidate
            .replace("\ufeff", "")
            .translate(smart_quote_translation)
            .strip(),
        ]

        seen_attempts: set[str] = set()
        for attempt in parse_attempts:
            if not attempt or attempt in seen_attempts:
                continue
            seen_attempts.add(attempt)

            try:
                parsed = parse_as_object(attempt)
                if parsed is not None:
                    return parsed
            except json.JSONDecodeError:
                extracted = extract_first_json_object(attempt)
                if not extracted or extracted == attempt:
                    continue
                try:
                    parsed = parse_as_object(extracted)
                    if parsed is not None:
                        return parsed
                except json.JSONDecodeError:
                    continue

    raise GeminiApiResponseError("Gemini returned invalid JSON.")


def _call_gemini_json_response(
    prompt: str,
    *,
    temperature: float,
    max_output_tokens: int,
) -> dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiApiKeyMissingError("GEMINI_API_KEY is missing.")

    model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
    url = f"{GEMINI_API_BASE}/{model}:generateContent?key={api_key}"

    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "responseMimeType": "application/json",
        },
    }

    try:
        response = requests.post(url, json=request_body, timeout=75)
    except requests.RequestException as exc:
        raise GeminiApiRequestError(f"Failed to call Gemini API: {str(exc)}") from exc

    if not response.ok:
        api_message = ""
        try:
            error_payload = response.json()
            api_message = str(error_payload.get("error", {}).get("message", "")).strip()
        except ValueError:
            api_message = response.text[:500]

        normalized_message = api_message.lower()
        if response.status_code == 429 or "quota exceeded" in normalized_message:
            raise GeminiQuotaExceededError(
                "Gemini quota exceeded for this API project. Enable billing or use a project with available quota."
            )

        if response.status_code == 403 and "reported as leaked" in normalized_message:
            raise GeminiApiKeyLeakedError(
                "GEMINI_API_KEY has been blocked as leaked. Rotate it in Google AI Studio and update server/.env."
            )

        details = api_message or response.text[:500]
        raise GeminiApiRequestError(
            f"Gemini API request failed with status {response.status_code}. {details}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise GeminiApiResponseError("Gemini API response was not valid JSON.") from exc

    candidates = payload.get("candidates", [])
    response_text = ""

    for candidate in candidates:
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        texts = [str(part.get("text", "")) for part in parts if isinstance(part, dict)]
        joined = "\n".join(texts).strip()
        if joined:
            response_text = joined
            break

    if not response_text:
        raise GeminiApiResponseError("Gemini returned an empty response.")

    return _clean_json_text(response_text)


def _truncate_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(" ,;:") + "."


def _normalize_string_list(value: Any, max_words: int = 24) -> list[str]:
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
    elif isinstance(value, str):
        items = []
        for line in value.splitlines():
            cleaned = line.strip().lstrip("-").lstrip("*").strip()
            if cleaned:
                items.append(cleaned)
    else:
        items = []

    unique_items: list[str] = []
    seen = set()
    for item in items:
        lowered = item.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_items.append(_truncate_words(item, max_words))
    return unique_items


def _normalize_milestones(value: Any) -> list[dict[str, str]]:
    milestones: list[dict[str, str]] = []

    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                title = str(item.get("title", "")).strip()
                description = str(item.get("description", "")).strip()
                if title and description:
                    milestones.append(
                        {
                            "title": _truncate_words(title, 8),
                            "description": _truncate_words(description, 22),
                        }
                    )
            elif isinstance(item, str):
                text = item.strip()
                if not text:
                    continue
                parts = text.split(":", 1)
                if len(parts) == 2:
                    title = parts[0].strip()
                    description = parts[1].strip()
                else:
                    title = text
                    description = "Implementation details and delivery checkpoint."
                if title and description:
                    milestones.append(
                        {
                            "title": _truncate_words(title, 8),
                            "description": _truncate_words(description, 22),
                        }
                    )
    elif isinstance(value, str):
        for line in value.splitlines():
            cleaned = line.strip().lstrip("-").lstrip("*").strip()
            if not cleaned:
                continue
            parts = cleaned.split(":", 1)
            if len(parts) == 2:
                title = parts[0].strip()
                description = parts[1].strip()
            else:
                title = cleaned
                description = "Implementation details and delivery checkpoint."
            if title and description:
                milestones.append(
                    {
                        "title": _truncate_words(title, 8),
                        "description": _truncate_words(description, 22),
                    }
                )

    unique_milestones: list[dict[str, str]] = []
    seen = set()
    for milestone in milestones:
        key = (milestone["title"].lower(), milestone["description"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique_milestones.append(milestone)
    return unique_milestones


def _validate_item_count(items: list[Any], min_items: int, max_items: int, field_name: str) -> list[Any]:
    if len(items) < min_items:
        raise GeminiApiResponseError(
            f"Gemini returned too few items for {field_name}. Expected at least {min_items}."
        )
    if len(items) > max_items:
        return items[:max_items]
    return items


def _fallback_risks(intake: dict[str, str]) -> list[str]:
    timeline = intake.get("timeline", "").strip().lower()
    required_features = intake.get("required_features", "").strip().lower()

    defaults = [
        "Scope expansion beyond the agreed feature list can affect budget and delivery dates.",
        "Delayed stakeholder feedback can push milestone approvals and final launch timing.",
        "Unclear requirements for key workflows may cause rework during implementation.",
        "Third-party tools or API dependencies may introduce delays outside project control.",
    ]

    if timeline and any(token in timeline for token in ["2 week", "3 week", "1 month", "2 month"]):
        defaults[1] = "A compressed timeline may require phased delivery to protect release quality."

    if not required_features:
        defaults[2] = "If core requirements stay broad, scope decisions may take longer and impact delivery."

    return defaults


def _extract_feature_items(required_features: str) -> list[str]:
    raw = required_features.replace(";", "\n").replace(",", "\n")
    items = _extract_lines(raw)
    if not items:
        return []

    normalized_items: list[str] = []
    seen = set()
    for item in items:
        compact = _normalize_space(item)
        lowered = compact.lower()
        if not compact or lowered in seen or _is_low_signal_text(compact):
            continue
        seen.add(lowered)
        normalized_items.append(_truncate_words(compact, 10))
    return normalized_items


def _fallback_generated_proposal(intake: dict[str, str]) -> dict[str, Any]:
    business_type = _normalize_space(intake.get("business_type", "")).strip()
    project_goals = _normalize_space(intake.get("project_goals", "")).strip()
    required_features = _normalize_space(intake.get("required_features", "")).strip()
    timeline = _normalize_space(intake.get("timeline", "")).strip() or "6-10 weeks"
    client_name = _normalize_space(intake.get("client_name", "")).strip() or "the client"

    archetype = _detect_template_archetype(
        f"{business_type} {project_goals} {required_features}",
        category_hint=business_type,
    )
    blueprint = _get_template_blueprint(archetype)

    feature_items = _extract_feature_items(required_features)
    if len(feature_items) < 2:
        feature_items = [str(item) for item in blueprint.get("scope", [])[:3]]

    focus_text = ", ".join(feature_items[:3]).strip()
    if not focus_text:
        focus_text = "core delivery priorities"

    summary = _truncate_words(
        f"We will deliver a {business_type or str(blueprint['category']).lower()} project for {client_name} "
        f"focused on {project_goals or 'clear business outcomes'}, with execution centered on {focus_text}. "
        f"Delivery will be phased over approximately {timeline} with regular review checkpoints.",
        75,
    )

    scope_candidates = [
        "Discovery and technical planning aligned to project goals",
        *[f"Implement {item}" for item in feature_items[:4]],
        "Quality assurance, revisions, and launch readiness",
    ]
    scope_of_work = _merge_with_fallback_items(
        scope_candidates,
        list(blueprint.get("scope", [])),
        min_items=4,
        max_items=8,
        max_words=18,
    )

    deliverable_candidates = [
        "Project execution plan with agreed scope boundaries",
        *[f"Completed implementation of {item}" for item in feature_items[:4]],
        "QA report and launch handover package",
    ]
    deliverables = _merge_with_fallback_items(
        deliverable_candidates,
        list(blueprint.get("deliverables", [])),
        min_items=5,
        max_items=8,
        max_words=16,
    )

    milestone_lines = [
        "Discovery: Confirm scope, priorities, and delivery sequence.",
        "Execution: Build and review core features in iterative checkpoints.",
        "Validation: QA, bug fixes, and final acceptance preparation.",
        "Launch: Production release and handover documentation.",
    ]
    milestone_defaults = list(blueprint.get("milestones", []))
    merged_milestones = _merge_with_fallback_items(
        milestone_lines,
        milestone_defaults,
        min_items=3,
        max_items=5,
        max_words=22,
    )
    milestones = _normalize_milestones(merged_milestones)
    milestones = _validate_item_count(milestones, min_items=3, max_items=5, field_name="milestones")

    risks = _normalize_string_list(_fallback_risks(intake), max_words=18)
    risks = _validate_item_count(risks, min_items=2, max_items=4, field_name="risks")

    return {
        "summary": summary,
        "scope_of_work": scope_of_work,
        "deliverables": deliverables,
        "milestones": milestones,
        "risks": risks,
    }


LOW_SIGNAL_PHRASES = {
    "i dont know",
    "i don't know",
    "idk",
    "something",
    "something good",
    "stuff",
    "things",
    "etc",
    "tbd",
    "to be decided",
    "unknown",
    "n/a",
    "na",
}

GENERIC_SINGLE_WORDS = {
    "product",
    "products",
    "service",
    "services",
    "project",
    "template",
    "website",
    "app",
}


def _normalize_space(value: Any) -> str:
    return " ".join(str(value).split()).strip()


def _is_low_signal_text(value: Any) -> bool:
    text = _normalize_space(value).lower()
    if not text:
        return True

    if text in LOW_SIGNAL_PHRASES:
        return True

    if any(phrase in text for phrase in LOW_SIGNAL_PHRASES):
        return True

    words = [word for word in text.split(" ") if word]
    if len(words) == 1 and words[0] in GENERIC_SINGLE_WORDS:
        return True

    if len(words) <= 2 and text in {"good", "nice", "better", "new"}:
        return True

    return False


def _extract_lines(value: Any) -> list[str]:
    if isinstance(value, list):
        raw_lines = [str(item) for item in value]
    elif isinstance(value, str):
        raw_lines = value.splitlines()
    else:
        raw_lines = []

    lines = []
    for line in raw_lines:
        cleaned = str(line).strip().lstrip("-").lstrip("*").strip()
        if cleaned:
            lines.append(cleaned)
    return lines


def _detect_template_archetype(user_prompt: str, category_hint: str = "") -> str:
    text = f"{user_prompt} {category_hint}".lower()

    if any(token in text for token in ["ecommerce", "e-commerce", "shopify", "store", "checkout", "catalog"]):
        return "ecommerce"
    if any(token in text for token in ["saas", "mvp", "startup", "subscription", "b2b platform"]):
        return "saas"
    if any(token in text for token in ["dashboard", "admin", "internal tool", "backoffice", "operations"]):
        return "internal-tools"
    if any(token in text for token in ["mobile", "ios", "android", "app launch", "app"]):
        return "mobile-app"
    if any(token in text for token in ["redesign", "landing page", "website", "web design", "seo"]):
        return "web-design"
    if any(token in text for token in ["brand", "content", "marketing", "campaign"]):
        return "marketing"

    return "general"


def _get_template_blueprint(archetype: str) -> dict[str, Any]:
    blueprints: dict[str, dict[str, Any]] = {
        "ecommerce": {
            "category": "E-commerce",
            "name": "E-commerce Growth Template",
            "description": "For launching or optimizing online stores with stronger conversion flow and operational readiness.",
            "summary": "Launch or refine an e-commerce experience focused on conversion, reliable checkout, and smoother day-to-day store operations.",
            "scope": [
                "Store structure and conversion flow planning",
                "Product catalog and collection page optimization",
                "Checkout, payment, and shipping configuration",
                "Analytics, tracking, and sales funnel instrumentation",
                "Order management workflow and post-purchase setup",
            ],
            "deliverables": [
                "Finalized store architecture and user journey map",
                "Optimized product and collection page templates",
                "Configured checkout with payment and shipping rules",
                "Analytics dashboard with conversion event tracking",
                "Launch checklist and operational handover notes",
            ],
            "milestones": [
                "Discovery and commercial priorities alignment",
                "Store and conversion flow implementation",
                "Testing, QA, and launch preparation",
                "Go-live and performance optimization handover",
            ],
            "timeline": "6-8 weeks",
            "assumptions": "Client provides product data, pricing rules, and brand assets on agreed review timelines.",
            "risks": "Late catalog changes or third-party app dependencies may impact launch timing.",
        },
        "saas": {
            "category": "SaaS",
            "name": "SaaS MVP Template",
            "description": "For building lean SaaS MVPs with clear core workflows and production-ready delivery.",
            "summary": "Build a focused SaaS MVP centered on core user workflows, fast validation, and a stable production release baseline.",
            "scope": [
                "MVP scope definition and feature prioritization",
                "Core workflow implementation for primary users",
                "Authentication, authorization, and account setup",
                "Operational dashboard and key reporting views",
                "Release readiness, monitoring, and handover setup",
            ],
            "deliverables": [
                "Validated MVP scope and feature breakdown",
                "Working SaaS application with core workflows",
                "Admin controls for key operational tasks",
                "Production deployment baseline and monitoring setup",
                "Technical documentation and handover guidance",
            ],
            "milestones": [
                "Scope alignment and architecture direction",
                "Core product build and iterative reviews",
                "Quality assurance and stabilization sprint",
                "Production release and post-launch handover",
            ],
            "timeline": "10-12 weeks",
            "assumptions": "Product owner feedback is provided in each review sprint.",
            "risks": "Scope expansion during build may require timeline or phase adjustments.",
        },
        "web-design": {
            "category": "Web Design",
            "name": "Website Redesign Template",
            "description": "For redesign projects that need stronger messaging, UX clarity, and improved conversion flow.",
            "summary": "Redesign the website to improve message clarity, trust signals, and conversion outcomes while preserving brand consistency.",
            "scope": [
                "Current-site UX and conversion audit",
                "Information architecture and page hierarchy updates",
                "Responsive UI design for key templates",
                "Front-end implementation and CMS readiness",
                "Quality assurance and pre-launch refinement",
            ],
            "deliverables": [
                "Audit findings and redesign direction document",
                "Approved desktop and mobile page designs",
                "Implemented responsive template set",
                "CMS-ready content structure and components",
                "Launch checklist with QA summary",
            ],
            "milestones": [
                "Discovery and redesign direction approval",
                "Design system and template production",
                "Build, QA, and revision cycle",
                "Launch handover and optimization notes",
            ],
            "timeline": "8-10 weeks",
            "assumptions": "Client supplies final copy and brand assets within agreed review windows.",
            "risks": "Delayed content feedback may shift design approval and launch dates.",
        },
        "internal-tools": {
            "category": "Internal Tools",
            "name": "Internal Dashboard Template",
            "description": "For internal operations dashboards with role-based visibility and practical workflow automation.",
            "summary": "Build an internal dashboard that centralizes operational visibility and speeds up recurring team workflows.",
            "scope": [
                "Workflow discovery and internal role mapping",
                "Dashboard views for core operational metrics",
                "Data table, filter, and export functionality",
                "Role-based access and activity audit trails",
                "User testing and rollout readiness",
            ],
            "deliverables": [
                "Workflow specification and UI planning assets",
                "Operational dashboard with core modules",
                "Role-based permissions and access controls",
                "Data export and reporting setup",
                "Admin onboarding and handover documentation",
            ],
            "milestones": [
                "Discovery and operational requirements mapping",
                "Dashboard implementation and integration",
                "Testing, acceptance, and refinements",
                "Rollout, training, and support handover",
            ],
            "timeline": "8-12 weeks",
            "assumptions": "Internal stakeholders provide sample data and testing feedback on schedule.",
            "risks": "Data source inconsistencies may require additional integration effort.",
        },
        "mobile-app": {
            "category": "Mobile App",
            "name": "Mobile App Launch Template",
            "description": "For mobile app projects focused on core user journeys, release readiness, and early adoption.",
            "summary": "Deliver a mobile app focused on high-priority user journeys, reliable release quality, and clear launch execution.",
            "scope": [
                "User journey mapping and feature prioritization",
                "UI design and interaction flow for key screens",
                "Core app feature implementation",
                "Backend/API integration and quality validation",
                "Release preparation and handover support",
            ],
            "deliverables": [
                "Finalized mobile user journey specification",
                "Production-ready app for core workflows",
                "Integrated backend services and data flows",
                "QA report and release checklist",
                "Launch support and handover guidance",
            ],
            "milestones": [
                "Planning and UX direction alignment",
                "Core build and feature validation",
                "QA, performance, and release prep",
                "Launch and post-release handover",
            ],
            "timeline": "10-14 weeks",
            "assumptions": "App store assets and compliance inputs are provided during release planning.",
            "risks": "Third-party SDK or app-review delays can impact go-live timing.",
        },
        "marketing": {
            "category": "Marketing",
            "name": "Marketing Campaign Template",
            "description": "For campaign execution with clear creative assets, launch phases, and performance reporting.",
            "summary": "Plan and execute a focused campaign with clear messaging, production deliverables, and measurable performance goals.",
            "scope": [
                "Campaign strategy and audience alignment",
                "Messaging framework and creative direction",
                "Asset production and channel setup",
                "Launch cadence and optimization cycle",
                "Performance reporting and next-step planning",
            ],
            "deliverables": [
                "Campaign strategy brief and execution roadmap",
                "Core copy and visual creative assets",
                "Channel launch setup and tracking plan",
                "Performance dashboard and insight summary",
                "Optimization recommendations for next cycle",
            ],
            "milestones": [
                "Strategy alignment and message approval",
                "Creative production and channel setup",
                "Campaign launch and optimization pass",
                "Reporting and iteration planning",
            ],
            "timeline": "4-6 weeks",
            "assumptions": "Brand approvals and legal checks are completed within planned timelines.",
            "risks": "Delayed approvals can reduce media efficiency and compress optimization time.",
        },
        "general": {
            "category": "General",
            "name": "Custom Proposal Template",
            "description": "For multi-phase delivery projects that need clear structure, milestones, and practical handover.",
            "summary": "Create a structured proposal plan with clear scope boundaries, tangible deliverables, and a realistic delivery sequence.",
            "scope": [
                "Discovery and requirement alignment",
                "Solution planning and execution framework",
                "Core implementation of agreed priorities",
                "Quality review and revision cycle",
                "Launch readiness and handover planning",
            ],
            "deliverables": [
                "Scope and execution plan",
                "Implemented core deliverables",
                "QA summary and revision log",
                "Final handover package",
                "Post-launch support recommendations",
            ],
            "milestones": [
                "Discovery and direction confirmation",
                "Build and review cycle",
                "Testing and refinement",
                "Launch and handover",
            ],
            "timeline": "6-10 weeks",
            "assumptions": "Stakeholders provide timely feedback and required assets at each review stage.",
            "risks": "Late requirement changes may affect delivery timeline and effort.",
        },
    }

    return blueprints.get(archetype, blueprints["general"])


def _match_existing_category(preferred: str, existing_categories: list[str]) -> str:
    normalized_preferred = preferred.strip().lower()
    for category in existing_categories:
        if category.strip().lower() == normalized_preferred:
            return category.strip()
    return preferred.strip()


def _build_template_prompt(user_prompt: str, existing_categories: list[str]) -> str:
    schema = {
        "name": "string",
        "description": "string",
        "category": "string",
        "sections": {
            "summary": {"included": "boolean", "content": "string"},
            "scope": {"included": "boolean", "content": "string"},
            "deliverables": {"included": "boolean", "content": "string"},
            "milestones": {"included": "boolean", "content": "string"},
            "timeline": {"included": "boolean", "content": "string"},
            "assumptions": {"included": "boolean", "content": "string"},
            "risks": {"included": "boolean", "content": "string"},
        },
    }

    category_hint = ", ".join(existing_categories[:12]).strip()
    category_rule = (
        f"Prefer one of these exact categories when it fits: {category_hint}."
        if category_hint
        else "Choose a concise category name."
    )

    return f"""
You are a senior proposal strategist creating reusable proposal templates.
Transform the short user prompt into a polished template draft with practical default content.
Write with the same concise and realistic tone used in modern agency proposal templates.

Return valid JSON only. No markdown. No code fences. No commentary.

Required JSON shape:
{json.dumps(schema)}

Rules:
- name:
  - 2 to 5 words.
  - Should read like a reusable template title.
  - Include "Proposal" only when natural.
- description:
  - One sentence.
  - Explain when this template should be used.
  - Keep it specific and concise.
- category:
  - Short and clear project type.
  - {category_rule}
- sections.summary:
  - included must be true.
  - One concise paragraph describing the project intent and outcome.
- sections.scope:
  - included must be true.
  - 4 to 6 bullet points using "- " prefixes.
  - Each line is a concrete workstream.
- sections.deliverables:
  - included must be true.
  - 4 to 6 bullet points using "- " prefixes.
  - Tangible outputs only.
- sections.milestones:
  - included must be true.
  - 3 to 5 short lines in execution order.
  - No numbering.
- sections.timeline:
  - included must be true.
  - Short duration text like "6-8 weeks" or "10-12 weeks".
- sections.assumptions:
  - include only when useful.
  - If included, one concise sentence.
- sections.risks:
  - include when useful.
  - If included, one concise sentence.

Style constraints:
- Keep content practical and believable.
- Avoid vague buzzwords and generic filler.
- Do not invent legal/compliance guarantees.
- Keep each section ready for real proposal use without heavy editing.
- Do not copy the user prompt verbatim into section content.
- If the user prompt is short or vague, infer a plausible professional template and add concrete details.
- Never output placeholders like "I don't know", "something", "TBD", or "etc".

User prompt:
{user_prompt.strip()}
""".strip()


def _expand_sparse_template_prompt(user_prompt: str) -> str:
    normalized_prompt = _normalize_space(user_prompt)
    if not normalized_prompt:
        return normalized_prompt

    if len(normalized_prompt.split()) >= 5 and not _is_low_signal_text(normalized_prompt):
        return normalized_prompt

    archetype = _detect_template_archetype(normalized_prompt)
    blueprint = _get_template_blueprint(archetype)
    return (
        f"{normalized_prompt}. Use a {blueprint['category']} template style with concrete scope, "
        f"deliverables, milestones, and a realistic {blueprint['timeline']} timeline."
    )


def _normalize_multiline_text(value: Any) -> str:
    if isinstance(value, str):
        lines = value.splitlines()
    elif isinstance(value, list):
        lines = [str(item) for item in value]
    else:
        lines = []

    cleaned_lines = [line.strip() for line in lines if str(line).strip()]
    return "\n".join(cleaned_lines).strip()


def _normalize_bullet_lines(value: Any, *, max_items: int) -> str:
    lines = _extract_lines(value)

    unique_lines: list[str] = []
    seen = set()
    for line in lines:
        normalized = _normalize_space(line)
        if _is_low_signal_text(normalized):
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_lines.append(_truncate_words(normalized, 18))

    return "\n".join([f"- {line}" for line in unique_lines[:max_items]])


def _normalize_milestone_lines(value: Any, *, max_items: int) -> str:
    lines = []

    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                title = str(item.get("title", "")).strip()
                description = str(item.get("description", "")).strip()
                if title and description:
                    lines.append(f"{title}: {description}")
                elif title:
                    lines.append(title)
            else:
                cleaned = str(item).strip().lstrip("-").lstrip("*").strip()
                if cleaned:
                    lines.append(cleaned)
    elif isinstance(value, str):
        for line in value.splitlines():
            cleaned = line.strip().lstrip("-").lstrip("*").strip()
            if cleaned:
                lines.append(cleaned)

    unique_lines: list[str] = []
    seen = set()
    for line in lines:
        normalized = _normalize_space(line)
        if _is_low_signal_text(normalized):
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_lines.append(_truncate_words(normalized, 22))

    return "\n".join(unique_lines[:max_items])


def _fallback_template_name(user_prompt: str) -> str:
    archetype = _detect_template_archetype(user_prompt)
    blueprint = _get_template_blueprint(archetype)
    cleaned = user_prompt.replace("-", " ").replace("_", " ").strip()
    words = [word for word in cleaned.split() if word.strip()]

    if len(words) < 3 or _is_low_signal_text(cleaned):
        return str(blueprint["name"])

    base = " ".join(words[:4]).strip().title()
    if "template" not in base.lower() and "proposal" not in base.lower():
        base = f"{base} Template"
    return base


def _fallback_template_category(user_prompt: str, existing_categories: list[str]) -> str:
    archetype = _detect_template_archetype(user_prompt)
    preferred_category = str(_get_template_blueprint(archetype)["category"])
    matched_existing = _match_existing_category(preferred_category, existing_categories)

    lowered_prompt = user_prompt.lower()
    for category in existing_categories:
        if category.lower() in lowered_prompt:
            return category

    return matched_existing


def _fallback_template_sections(archetype: str) -> dict[str, dict[str, Any]]:
    blueprint = _get_template_blueprint(archetype)
    return {
        "summary": {
            "included": True,
            "content": str(blueprint["summary"]),
        },
        "scope": {
            "included": True,
            "content": "\n".join([f"- {item}" for item in blueprint["scope"]]),
        },
        "deliverables": {
            "included": True,
            "content": "\n".join([f"- {item}" for item in blueprint["deliverables"]]),
        },
        "milestones": {
            "included": True,
            "content": "\n".join(blueprint["milestones"]),
        },
        "timeline": {"included": True, "content": str(blueprint["timeline"])},
        "assumptions": {
            "included": False,
            "content": str(blueprint["assumptions"]),
        },
        "risks": {
            "included": False,
            "content": str(blueprint["risks"]),
        },
    }


def _merge_with_fallback_items(
    primary_items: list[str],
    fallback_items: list[str],
    *,
    min_items: int,
    max_items: int,
    max_words: int,
) -> list[str]:
    merged: list[str] = []
    seen = set()

    for source_items in [primary_items, fallback_items]:
        for item in source_items:
            normalized = _normalize_space(item)
            if _is_low_signal_text(normalized):
                continue
            lowered = normalized.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            merged.append(_truncate_words(normalized, max_words))
            if len(merged) >= max_items:
                break
        if len(merged) >= max_items:
            break

    if len(merged) < min_items:
        for fallback_item in fallback_items:
            normalized = _normalize_space(fallback_item)
            lowered = normalized.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            merged.append(_truncate_words(normalized, max_words))
            if len(merged) >= min_items:
                break

    return merged[:max_items]


def _build_summary_fallback(user_prompt: str, archetype: str) -> str:
    blueprint = _get_template_blueprint(archetype)
    normalized_prompt = _normalize_space(user_prompt)

    if _is_low_signal_text(normalized_prompt) or len(normalized_prompt.split()) < 4:
        return str(blueprint["summary"])

    return _truncate_words(
        f"{blueprint['summary']} Focus area: {normalized_prompt}.",
        75,
    )


def _is_valid_timeline_text(value: str) -> bool:
    text = _normalize_space(value).lower()
    if not text or _is_low_signal_text(text):
        return False

    duration_tokens = ["day", "days", "week", "weeks", "month", "months", "quarter", "quarters"]
    has_duration_token = any(token in text for token in duration_tokens)
    has_number = any(char.isdigit() for char in text) or any(
        token in text for token in ["one", "two", "three", "four", "five", "six", "eight", "ten", "twelve"]
    )

    return has_duration_token and has_number


def normalize_generated_template_draft(
    data: dict[str, Any],
    *,
    user_prompt: str,
    existing_categories: list[str] | None = None,
) -> dict[str, Any]:
    categories = [str(category).strip() for category in (existing_categories or []) if str(category).strip()]
    archetype = _detect_template_archetype(user_prompt)
    blueprint = _get_template_blueprint(archetype)
    fallback_sections = _fallback_template_sections(archetype)

    name = " ".join(str(data.get("name", "")).split()).strip()
    if not name or _is_low_signal_text(name) or name.lower() == _normalize_space(user_prompt).lower():
        name = _fallback_template_name(user_prompt)
    name = _truncate_words(name, 8)

    description = " ".join(str(data.get("description", "")).split()).strip()
    if not description or _is_low_signal_text(description):
        description = str(blueprint["description"])
    description = _truncate_words(description, 28)

    category = " ".join(str(data.get("category", "")).split()).strip()
    if not category or _is_low_signal_text(category):
        category = _fallback_template_category(user_prompt, categories)
    category = _truncate_words(_match_existing_category(category, categories), 4)

    raw_sections = data.get("sections", {})
    if not isinstance(raw_sections, dict):
        raw_sections = {}

    normalized_sections: dict[str, dict[str, Any]] = {}
    required_keys = {"summary", "scope", "deliverables", "milestones", "timeline"}

    for key in ["summary", "scope", "deliverables", "milestones", "timeline", "assumptions", "risks"]:
        fallback = fallback_sections[key]
        raw_section = raw_sections.get(key, {})

        included = bool(fallback["included"])
        content_value: Any = raw_section
        has_explicit_included = False

        if isinstance(raw_section, dict):
            has_explicit_included = isinstance(raw_section.get("included"), bool)
            included = bool(raw_section.get("included", included))
            content_value = raw_section.get("content", "")

        if key in {"scope", "deliverables"}:
            generated_items = [line.lstrip("-").strip() for line in _extract_lines(_normalize_bullet_lines(content_value, max_items=8))]
            fallback_items = list(blueprint[key])
            merged_items = _merge_with_fallback_items(
                generated_items,
                fallback_items,
                min_items=4,
                max_items=6,
                max_words=18,
            )
            content = "\n".join([f"- {item}" for item in merged_items])
        elif key == "milestones":
            generated_items = _extract_lines(_normalize_milestone_lines(content_value, max_items=6))
            fallback_items = list(blueprint["milestones"])
            merged_items = _merge_with_fallback_items(
                generated_items,
                fallback_items,
                min_items=3,
                max_items=5,
                max_words=22,
            )
            content = "\n".join(merged_items)
        elif key == "timeline":
            content = " ".join(_normalize_multiline_text(content_value).split()).strip()
            if not _is_valid_timeline_text(content) or len(content.split()) > 6:
                content = str(blueprint["timeline"])
        elif key == "summary":
            content = " ".join(_normalize_multiline_text(content_value).split()).strip()
            content = _truncate_words(content, 70)
            if _is_low_signal_text(content) or len(content.split()) < 10:
                content = _build_summary_fallback(user_prompt, archetype)
        else:
            content = " ".join(_normalize_multiline_text(content_value).split()).strip()
            content = _truncate_words(content, 20)
            if _is_low_signal_text(content):
                content = str(blueprint[key])

        if not content:
            content = str(fallback["content"])

        if key in required_keys:
            included = True

        if key in {"assumptions", "risks"}:
            if not has_explicit_included and content.strip():
                included = True
            included = included and bool(content.strip())

        normalized_sections[key] = {
            "included": included,
            "content": content.strip(),
        }

    return {
        "name": name,
        "description": description,
        "category": category,
        "sections": normalized_sections,
    }


def normalize_generated_proposal(data: dict[str, Any], intake: dict[str, str] | None = None) -> dict[str, Any]:
    summary = " ".join(str(data.get("summary", "")).split()).strip()
    if not summary:
        raise GeminiApiResponseError("Gemini returned an empty summary.")
    summary = _truncate_words(summary, 80)

    scope_of_work = _normalize_string_list(data.get("scope_of_work", []), max_words=18)
    deliverables = _normalize_string_list(data.get("deliverables", []), max_words=16)
    milestones = _normalize_milestones(data.get("milestones", []))
    risks = _normalize_string_list(data.get("risks", []), max_words=18)

    if intake and len(risks) < 2:
        for fallback in _fallback_risks(intake):
            lowered = fallback.lower()
            if lowered in {risk.lower() for risk in risks}:
                continue
            risks.append(fallback)
            if len(risks) >= 4:
                break

    scope_of_work = _validate_item_count(scope_of_work, min_items=4, max_items=8, field_name="scope_of_work")
    deliverables = _validate_item_count(deliverables, min_items=5, max_items=8, field_name="deliverables")
    milestones = _validate_item_count(milestones, min_items=3, max_items=5, field_name="milestones")
    risks = _validate_item_count(risks, min_items=2, max_items=4, field_name="risks")

    return {
        "summary": summary,
        "scope_of_work": scope_of_work,
        "deliverables": deliverables,
        "milestones": milestones,
        "risks": risks,
    }


def generate_structured_proposal(intake: dict[str, str]) -> dict[str, Any]:
    prompt = _build_prompt(intake)
    try:
        parsed = _call_gemini_json_response(prompt, temperature=0.2, max_output_tokens=900)
        return normalize_generated_proposal(parsed, intake=intake)
    except GeminiApiResponseError:
        return _fallback_generated_proposal(intake)


def generate_template_draft(user_prompt: str, existing_categories: list[str] | None = None) -> dict[str, Any]:
    normalized_prompt = str(user_prompt).strip()
    if not normalized_prompt:
        raise GeminiApiResponseError("user_prompt is required.")

    categories = [
        str(category).strip()
        for category in (existing_categories or [])
        if str(category).strip()
    ]

    expanded_prompt = _expand_sparse_template_prompt(normalized_prompt)
    prompt = _build_template_prompt(expanded_prompt, categories)
    try:
        parsed = _call_gemini_json_response(prompt, temperature=0.4, max_output_tokens=1200)
    except GeminiServiceError:
        parsed = {}
    return normalize_generated_template_draft(
        parsed,
        user_prompt=normalized_prompt,
        existing_categories=categories,
    )
