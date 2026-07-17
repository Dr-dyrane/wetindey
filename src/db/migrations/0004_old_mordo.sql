CREATE TABLE "problem_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(50) NOT NULL,
	"body" text NOT NULL,
	"user_id" uuid,
	"place_id" uuid,
	"item_variant_id" uuid,
	"unit_id" uuid,
	"context_label" text,
	"app_locale" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "problem_reports_created_at_idx" ON "problem_reports" USING btree ("created_at" DESC NULLS LAST);