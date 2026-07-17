ALTER TABLE "items" ADD COLUMN "category" varchar(100) DEFAULT 'food' NOT NULL;--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category");