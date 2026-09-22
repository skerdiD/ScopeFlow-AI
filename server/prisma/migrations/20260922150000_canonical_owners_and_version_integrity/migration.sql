-- Introduce an explicit external auth identity without repurposing Django's
-- legacy username column. Existing usernames are unique, so this backfill is safe.
ALTER TABLE "auth_user"
ADD COLUMN IF NOT EXISTS "supabase_id" VARCHAR(255);

UPDATE "auth_user"
SET "supabase_id" = "username"
WHERE "supabase_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "auth_user_supabase_id_key"
ON "auth_user" ("supabase_id");

-- Add canonical numeric ownership while retaining user_id for transitional
-- compatibility with legacy rows and the existing API response shape.
ALTER TABLE "proposals_proposalproject"
ADD COLUMN IF NOT EXISTS "owner_id" INTEGER;

UPDATE "proposals_proposalproject" AS project
SET "owner_id" = app_user."id"
FROM "auth_user" AS app_user
WHERE project."owner_id" IS NULL
  AND project."user_id" = app_user."username";

CREATE INDEX IF NOT EXISTS "proposal_owner_updated_idx"
ON "proposals_proposalproject" ("owner_id", "updated_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'proposal_owner_id_fkey'
      AND conrelid = 'proposals_proposalproject'::regclass
  ) THEN
    ALTER TABLE "proposals_proposalproject"
    ADD CONSTRAINT "proposal_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "auth_user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Preserve the first occurrence of each historical version number. Any
-- duplicates are assigned deterministic numbers above that project's old max.
WITH duplicate_rows AS (
  SELECT
    "id",
    "project_id",
    "version_number",
    "created_at",
    ROW_NUMBER() OVER (
      PARTITION BY "project_id", "version_number"
      ORDER BY "created_at", "id"
    ) AS duplicate_rank
  FROM "proposals_proposalversion"
),
project_maxima AS (
  SELECT "project_id", MAX("version_number") AS max_version
  FROM "proposals_proposalversion"
  GROUP BY "project_id"
),
renumbered AS (
  SELECT
    duplicate_rows."id",
    project_maxima.max_version + ROW_NUMBER() OVER (
      PARTITION BY duplicate_rows."project_id"
      ORDER BY duplicate_rows."version_number", duplicate_rows."created_at", duplicate_rows."id"
    ) AS new_version_number
  FROM duplicate_rows
  JOIN project_maxima USING ("project_id")
  WHERE duplicate_rows.duplicate_rank > 1
)
UPDATE "proposals_proposalversion" AS version
SET "version_number" = renumbered.new_version_number
FROM renumbered
WHERE version."id" = renumbered."id";

CREATE UNIQUE INDEX IF NOT EXISTS "proposal_project_version_key"
ON "proposals_proposalversion" ("project_id", "version_number");
