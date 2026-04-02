CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"client_name" varchar(255) NOT NULL,
	"project_name" varchar(255) NOT NULL,
	"project_type" varchar(120) NOT NULL,
	"budget" varchar(120),
	"timeline" varchar(120),
	"notes" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
