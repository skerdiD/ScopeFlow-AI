ALTER TABLE "proposals_proposalproject"
  ADD COLUMN "generation_source" VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN "generation_degraded" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "proposals_proposalversion"
  ADD COLUMN "generation_source" VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN "generation_degraded" BOOLEAN NOT NULL DEFAULT FALSE;
