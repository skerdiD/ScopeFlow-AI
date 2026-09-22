-- CreateTable
CREATE TABLE "auth_user" (
    "id" SERIAL NOT NULL,
    "password" VARCHAR(128) NOT NULL,
    "last_login" TIMESTAMPTZ(6),
    "is_superuser" BOOLEAN NOT NULL,
    "username" VARCHAR(150) NOT NULL,
    "first_name" VARCHAR(150) NOT NULL,
    "last_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "is_staff" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "date_joined" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_userplan" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_userplan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_usagerecord" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "ai_generations_used" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_usagerecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_aipromptversion" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_aipromptversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_proposalproject" (
    "id" BIGSERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "project_type" VARCHAR(120) NOT NULL,
    "budget" VARCHAR(120) NOT NULL,
    "timeline" VARCHAR(120) NOT NULL,
    "requirements" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "milestones" TEXT NOT NULL,
    "proposal_timeline" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "next_steps" TEXT NOT NULL,
    "payment_url" VARCHAR(200) NOT NULL,
    "missing_information" JSONB NOT NULL,
    "scope_risks" JSONB NOT NULL,
    "unclear_requirements" JSONB NOT NULL,
    "suggested_questions" JSONB NOT NULL,
    "generated_proposal" JSONB NOT NULL,
    "current_version_id" BIGINT,
    "status" VARCHAR(50) NOT NULL,
    "share_token" VARCHAR(64),
    "share_enabled" BOOLEAN NOT NULL,
    "share_created_at" TIMESTAMPTZ(6),
    "viewed_at" TIMESTAMPTZ(6),
    "client_name_response" VARCHAR(255) NOT NULL,
    "client_email_response" VARCHAR(254) NOT NULL,
    "client_response_comment" TEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "is_demo" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_proposalproject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_proposalversion" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "label" VARCHAR(50) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "changed_sections" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "deliverables" TEXT NOT NULL,
    "milestones" TEXT NOT NULL,
    "proposal_timeline" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "next_steps" TEXT NOT NULL,
    "is_final" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_proposalversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_proposalclientcomment" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "client_name" VARCHAR(255) NOT NULL,
    "client_email" VARCHAR(254) NOT NULL,
    "comment" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_proposalclientcomment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_aiusagelog" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "project_id" BIGINT,
    "action_type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "prompt_version_id" BIGINT,
    "error_message" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "estimated_cost" DECIMAL(10,6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_aiusagelog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals_aiqualityreview" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "proposal_version_id" BIGINT,
    "score" SMALLINT NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "prompt_version_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "proposals_aiqualityreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_username_key" ON "auth_user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_userplan_user_id_key" ON "proposals_userplan"("user_id");

-- CreateIndex
CREATE INDEX "proposals_usagerecord_period_4480abc8_idx" ON "proposals_usagerecord"("period");

-- CreateIndex
CREATE INDEX "usage_user_period_idx" ON "proposals_usagerecord"("user_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user_usage_period" ON "proposals_usagerecord"("user_id", "period");

-- CreateIndex
CREATE INDEX "proposals_aipromptversion_purpose_6f94cd09_idx" ON "proposals_aipromptversion"("purpose");

-- CreateIndex
CREATE INDEX "proposals_aipromptversion_is_active_777477ce_idx" ON "proposals_aipromptversion"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "unique_prompt_purpose_version" ON "proposals_aipromptversion"("purpose", "version");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_proposalproject_share_token_key" ON "proposals_proposalproject"("share_token");

-- CreateIndex
CREATE INDEX "proposals_proposalproject_user_id_6579922d_idx" ON "proposals_proposalproject"("user_id");

-- CreateIndex
CREATE INDEX "proposal_user_updated_idx" ON "proposals_proposalproject"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "proposal_ver_export_idx" ON "proposals_proposalversion"("project_id", "is_final", "created_at");

-- CreateIndex
CREATE INDEX "proposals_aiusagelog_action_type_41a0d6fd_idx" ON "proposals_aiusagelog"("action_type");

-- CreateIndex
CREATE INDEX "proposals_aiusagelog_status_0bd25afd_idx" ON "proposals_aiusagelog"("status");

-- CreateIndex
CREATE INDEX "proposals_aiusagelog_created_at_0dad7fe6_idx" ON "proposals_aiusagelog"("created_at");

-- CreateIndex
CREATE INDEX "ai_usage_user_created_idx" ON "proposals_aiusagelog"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_action_created_idx" ON "proposals_aiusagelog"("action_type", "created_at");

-- CreateIndex
CREATE INDEX "ai_review_project_created_idx" ON "proposals_aiqualityreview"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "proposals_userplan" ADD CONSTRAINT "proposals_userplan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_usagerecord" ADD CONSTRAINT "proposals_usagerecord_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_proposalproject" ADD CONSTRAINT "proposals_proposalproject_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "proposals_proposalversion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_proposalversion" ADD CONSTRAINT "proposals_proposalversion_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "proposals_proposalproject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_proposalclientcomment" ADD CONSTRAINT "proposals_proposalclientcomment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "proposals_proposalproject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiusagelog" ADD CONSTRAINT "proposals_aiusagelog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiusagelog" ADD CONSTRAINT "proposals_aiusagelog_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "proposals_proposalproject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiusagelog" ADD CONSTRAINT "proposals_aiusagelog_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "proposals_aipromptversion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiqualityreview" ADD CONSTRAINT "proposals_aiqualityreview_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "proposals_proposalproject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiqualityreview" ADD CONSTRAINT "proposals_aiqualityreview_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiqualityreview" ADD CONSTRAINT "proposals_aiqualityreview_proposal_version_id_fkey" FOREIGN KEY ("proposal_version_id") REFERENCES "proposals_proposalversion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals_aiqualityreview" ADD CONSTRAINT "proposals_aiqualityreview_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "proposals_aipromptversion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
