# ScopeFlow AI Backend Migration Inventory

This document captures the backend contract discovered before adding the Express foundation. The React frontend remains the API contract.

## Files Inspected

- Django config: `server/config/settings.py`, `server/config/urls.py`, `server/config/asgi.py`, `server/config/wsgi.py`
- Django app routing/API: `server/proposals/urls.py`, `server/proposals/views.py`
- Data layer: `server/proposals/models.py`, all `server/proposals/migrations/*.py`
- Serialization/validation: `server/proposals/serializers.py`
- Auth/security: `server/proposals/authentication.py`, `server/proposals/exception_handler.py`, `server/proposals/throttling.py`, `server/proposals/demo.py`
- Services: `server/proposals/services/gemini_service.py`, `usage_service.py`, `export_service.py`
- Demo/data utilities: `server/proposals/management/commands/seed_demo_data.py`
- Tests: `server/proposals/tests.py`, `tests_api.py`, `tests_demo.py`
- Environment/deploy/CI: `server/.env.example`, `server/requirements.txt`, root `package.json`, `.github/workflows/backend-tests.yml`, `.github/workflows/frontend-ci.yml`
- Frontend contract: `client/src/lib/api.ts`, `client/src/lib/supabase.ts`, `client/src/providers/auth-provider.tsx`, `client/src/lib/templates.ts`, `client/src/lib/activity.ts`, `client/src/hooks/use-templates.ts`, `client/src/hooks/use-activity.ts`, and API consumers found by `rg`

## Backend Features Discovered

- Supabase bearer-token authentication via `SUPABASE_URL/auth/v1/user`, using `SUPABASE_ANON_KEY`.
- Local Django `auth_user` mirror created per Supabase user, with demo email remapping to seeded demo account.
- User-scoped proposal projects by `ProposalProject.user_id == auth_user.username`, not by FK.
- CRUD project API with version snapshots for manual edits, generation, regeneration, final marking, and restores.
- Public proposal links with view tracking, approval/rejection response, and client comments.
- AI proposal generation, section regeneration, quality review, edit suggestions, and template draft generation through Gemini.
- Monthly usage tracking with plan limits: free `3`, pro `50`, business unlimited.
- AI usage logging with prompt version, token metadata, action status, and project relation.
- DOCX/PDF export with current, selected version, or final version content.
- Demo account protections: no AI actions, no delete, no payment links, no public approval links.
- Templates and activity are frontend localStorage-backed except AI template draft generation.

## Endpoint Inventory

| Method | URL | Auth | Request | Query | Success | Response |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/health/` | Public | none | none | 200 | `{ status, service }` |
| GET | `/api/projects/` | Bearer | none | none | 200 | `ProposalProjectListItem[]` |
| POST | `/api/projects/` | Bearer | project payload | none | 201 | `ProposalProject` |
| GET | `/api/projects/:id/` | Bearer owner | none | none | 200 | `ProposalProject` with versions/comments |
| PUT | `/api/projects/:id/` | Bearer owner | full project payload | none | 200 | `ProposalProject` |
| PATCH | `/api/projects/:id/` | Bearer owner | partial project payload | none | 200 | `ProposalProject` |
| DELETE | `/api/projects/:id/` | Bearer owner, not demo | none | none | 204 | empty |
| POST | `/api/projects/:id/restore-version/` | Bearer owner | `{ version_id }` | none | 200 | `ProposalProject` |
| POST | `/api/projects/:id/mark-final/` | Bearer owner | project partial/full payload | none | 200 | `ProposalProject` |
| POST | `/api/projects/:id/share-link/` | Bearer owner, not demo | `{ operation: "generate" \| "regenerate" \| "disable" }` | none | 200 | `ProposalProject` |
| GET | `/api/projects/:id/export/` | Bearer owner | none | `file_type=pdf|docx`, optional `version_id`, `final_version` | 200 | binary PDF/DOCX |
| POST | `/api/generate/` | Bearer, not demo | proposal intake payload | none | 201 | `ProposalProject` |
| POST | `/api/generate-template/` | Bearer, not demo | `{ user_prompt, existing_categories? }` | none | 200 | `TemplateDraftInput` |
| GET | `/api/usage/` | Bearer | none | none | 200 | `UsageStatus` |
| GET | `/api/workspace/` | Bearer | none | none | 200 | `{ projects, usage }` |
| POST | `/api/proposals/:id/regenerate-section/` | Bearer owner, not demo | `{ section, instructions? }` | none | 200 | `ProposalProject` |
| POST | `/api/proposals/:id/quality-review/` | Bearer owner, not demo | `{}` | none | 200 | `AIQualityReview` |
| POST | `/api/proposals/:id/edit-suggestions/` | Bearer owner, not demo | `{ section, content }` | none | 200 | `EditSuggestionsResponse` |
| GET | `/api/public/proposals/:token/` | Public link | none | none | 200 | `PublicProposal` |
| POST | `/api/public/proposals/:token/response/` | Public link | `{ status, confirmed, client_name, client_email, comment }` | none | 200 | `PublicProposal` |
| POST | `/api/public/proposals/:token/comments/` | Public link | `{ client_name?, client_email?, comment }` | none | 201 | `ProposalClientComment` |

Common error shape is DRF-style JSON, usually `{ "detail": "..." }`; serializer validation returns field-keyed errors. Auth failures are 401, owner misses are 404, demo restrictions are 403 except payment URL validation which is 400, usage limit is 429, Gemini transient failures are 429/500/502 depending on cause.

## Database Model Mapping

| Django Model | PostgreSQL Table | Key Fields / Relations | Prisma Model |
| --- | --- | --- | --- |
| `auth.User` | `auth_user` | `id`, `username` unique, `email`, Django auth flags | `DjangoUser` |
| `UserPlan` | `proposals_userplan` | one-to-one `user_id`, `plan`, timestamps | `UserPlan` |
| `UsageRecord` | `proposals_usagerecord` | FK `user_id`, `period`, unique `(user_id, period)`, usage count | `UsageRecord` |
| `AIPromptVersion` | `proposals_aipromptversion` | unique `(purpose, version)`, active prompt per purpose | `AIPromptVersion` |
| `ProposalProject` | `proposals_proposalproject` | owner string `user_id`, content fields, JSON arrays, share fields, status, current version FK | `ProposalProject` |
| `ProposalVersion` | `proposals_proposalversion` | FK `project_id` cascade, version sections, final flag | `ProposalVersion` |
| `ProposalClientComment` | `proposals_proposalclientcomment` | FK `project_id` cascade, client fields, comment | `ProposalClientComment` |
| `AIUsageLog` | `proposals_aiusagelog` | FK `user_id`, nullable project/prompt FKs, token usage, status | `AIUsageLog` |
| `AIQualityReview` | `proposals_aiqualityreview` | FK project/user, nullable version/prompt FKs, score and JSON lists | `AIQualityReview` |

Important constraints/indexes: `share_token` unique nullable; project index `(user_id, updated_at)`; proposal version export index `(project_id, is_final, created_at)`; usage unique `(user_id, period)`; AI usage indexes by user/action/created; quality review index `(project_id, created_at)`.

## New Express Architecture Created

- `src/app.ts` builds Express with JSON body parsing, CORS, Helmet, logging, API prefix mounting, 404, and centralized error handling.
- `src/server.ts` starts on port `8000` by default and disconnects Prisma on shutdown.
- `src/config/env.ts` loads `.env` and validates runtime configuration with Zod.
- `src/routes/*` mirrors the existing Django route surface with trailing-slash compatibility.
- `src/middleware/auth.middleware.ts` implements Supabase token verification and Django `auth_user` mirror lookup/create.
- `src/lib/prisma.ts` centralizes Prisma client access.
- `prisma/schema.prisma` maps Prisma models to existing Django/Supabase PostgreSQL tables without destructive migrations.
- `src/tests/app.test.ts` verifies health, CORS, JSON 404, and protected-route mounting.

## Dependencies Added

Runtime: `express`, `cors`, `helmet`, `morgan`, `dotenv`, `zod`, `@prisma/client`, `docx`, `pdfkit`.

Development: `typescript`, `tsx`, `prisma`, `vitest`, `supertest`, `@types/*`.

## Risks / Compatibility Notes

- The foundation stage intentionally returns `501` for unported non-health endpoints. Prompt 2 must port service behavior before switching production traffic.
- Prisma maps Django `BigAutoField` IDs as `BigInt`; controllers must serialize IDs back as numbers/strings compatible with the existing frontend.
- Django `auth_user` is still part of the live schema because plans, usage, and AI logs reference it. The Express backend must keep this mirror unless a separate data migration is designed.
- Gemini normalization/fallback behavior is large and must be ported carefully from `gemini_service.py`.
- PDF/DOCX output should be byte-compatible enough for frontend expectations, but not necessarily identical internally.
- The backend CI workflow still needs a Node/Prisma test job replacement before Django is removed from CI.

## Prompt 2 Persistence Migration

Completed in Express/Prisma:

- Project list, create, retrieve, update, partial update, and delete.
- Authenticated ownership is applied in every project lookup using both project id and the token-derived owner id; request-body `user_id` is accepted for client compatibility but discarded.
- Manual version snapshots, restore-version behavior, final-version relabeling/creation, current-version updates, and generated-proposal snapshots.
- Share-link generation, regeneration, disabling, public proposal views, approval/rejection responses, and client comments.
- Current usage and combined workspace responses, including automatic free-plan/current-period record creation.
- Supabase access-token verification and local `auth_user` mirror resolution, including the seeded demo identity mapping.
- DRF-compatible snake_case serialization, numeric ids, ISO timestamps, field validation errors, and 404 behavior for another user's resources.

Database introspection was attempted with `prisma db pull` against a temporary schema file. The configured Supabase pooler rejected the configured tenant/user as unknown, so no live schema was written and no database mutation occurred. The checked-in Prisma schema remains derived from all Django models and migrations and passes `prisma validate` and client generation. Live introspection and a read-only query must be repeated when a current `DATABASE_URL` is available.

Templates and activity have no Django database models or CRUD endpoints: they remain frontend local-storage features. `/api/generate-template/` is a Gemini generation endpoint rather than template persistence.

## Remaining For Prompt 3

- Port Gemini proposal generation, template draft generation, section regeneration, quality review, edit suggestions, prompt selection, token accounting, and AI usage logs.
- Port PDF/DOCX exports and preserve download headers and version selectors.
- Port the demo seed command and login-time demo workspace self-healing; demo authorization restrictions are already enforced for migrated writes.
- Add throttling parity for AI routes.
- Repeat live Prisma introspection and database smoke queries with a working `DATABASE_URL`.
- Switch deployment traffic only after the remaining `501` routes are implemented and end-to-end tested.
