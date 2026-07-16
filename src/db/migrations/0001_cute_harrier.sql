ALTER TABLE "items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "image_attribution" text;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "image_license" varchar(64);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "image_source_url" text;