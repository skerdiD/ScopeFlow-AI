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

    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
        raise GeminiApiResponseError("Gemini did not return a JSON object.")
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        raise GeminiApiResponseError("Gemini returned invalid JSON.")


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
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiApiKeyMissingError("GEMINI_API_KEY is missing.")

    model = os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
    url = f"{GEMINI_API_BASE}/{model}:generateContent?key={api_key}"
    prompt = _build_prompt(intake)

    request_body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 900,
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

    parsed = _clean_json_text(response_text)
    return normalize_generated_proposal(parsed, intake=intake)
