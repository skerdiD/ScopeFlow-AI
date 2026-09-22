ALTER TABLE "proposals_proposalproject"
ADD COLUMN "share_expires_at" TIMESTAMPTZ(6);

CREATE INDEX "proposal_share_expiry_idx"
ON "proposals_proposalproject" ("share_expires_at");
