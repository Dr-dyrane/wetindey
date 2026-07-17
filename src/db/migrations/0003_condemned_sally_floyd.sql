ALTER TABLE "sources" ADD COLUMN "user_id" uuid;--> statement-breakpoint
CREATE INDEX "sources_user_id_idx" ON "sources" USING btree ("user_id");