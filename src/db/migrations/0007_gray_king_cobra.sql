CREATE TABLE "review_aggregates" (
	"reviewable_type" varchar(100) NOT NULL,
	"reviewable_id" uuid NOT NULL,
	"rating_average" double precision DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_aggregates_reviewable_type_reviewable_id_pk" PRIMARY KEY("reviewable_type","reviewable_id")
);
--> statement-breakpoint
CREATE TABLE "review_helpful_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"user_id" uuid,
	"is_helpful" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"reviewable_type" varchar(100) NOT NULL,
	"reviewable_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(255),
	"body" text,
	"moderation_status" varchar(50) DEFAULT 'approved' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_aggregates_reviewable_idx" ON "review_aggregates" USING btree ("reviewable_type","reviewable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_helpful_user_idx" ON "review_helpful_votes" USING btree ("review_id","user_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewable_idx" ON "reviews" USING btree ("reviewable_type","reviewable_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_moderation_idx" ON "reviews" USING btree ("moderation_status");