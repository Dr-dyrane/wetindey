ALTER TABLE "user_profiles" ADD COLUMN "location_sharing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "avatar_url" text;