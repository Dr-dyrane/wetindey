ALTER TABLE "observations" ADD COLUMN "did_buy" boolean;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "contact_channel_kind" varchar(50);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "contact_channel_value" varchar(255);--> statement-breakpoint
CREATE INDEX "areas_center_gist_idx" ON "areas" USING gist ("center");--> statement-breakpoint
CREATE INDEX "item_aliases_item_id_idx" ON "item_aliases" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "item_variants_item_id_idx" ON "item_variants" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "observations_variant_unit_place_idx" ON "observations" USING btree ("item_variant_id","unit_id","place_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_current_variant_unit_place_key" ON "offers_current" USING btree ("item_variant_id","unit_id","place_id");--> statement-breakpoint
CREATE INDEX "offers_current_place_id_idx" ON "offers_current" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "offers_current_unit_id_idx" ON "offers_current" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "offers_current_variant_last_observed_idx" ON "offers_current" USING btree ("item_variant_id","last_observed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "places_location_gist_idx" ON "places" USING gist ("location");--> statement-breakpoint
CREATE INDEX "places_area_id_idx" ON "places" USING btree ("area_id");