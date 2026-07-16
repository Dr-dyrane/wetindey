CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"parent_area_id" uuid,
	"center" "geography" NOT NULL,
	"coverage_status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "item_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"alias" varchar(255) NOT NULL,
	"locale" varchar(50) DEFAULT 'en' NOT NULL,
	"normalized_alias" varchar(255) NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"slug" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"attributes" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "item_variants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"canonical_name" varchar(255) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_variant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"availability_state" varchar(50) NOT NULL,
	"price_amount" integer,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"observed_at" timestamp NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"collection_method" varchar(100) NOT NULL,
	"moderation_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "offers_current" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_variant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"availability_state" varchar(50) NOT NULL,
	"price_kind" varchar(50) NOT NULL,
	"price_min" integer NOT NULL,
	"price_max" integer,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"freshness_state" varchar(50) NOT NULL,
	"trust_level" varchar(50) NOT NULL,
	"last_observed_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"supporting_observation_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"place_type" varchar(100) NOT NULL,
	"area_id" uuid NOT NULL,
	"location" "geography" NOT NULL,
	"address" text,
	"opening_information" text,
	"verification_status" varchar(50) DEFAULT 'unverified' NOT NULL,
	"contact_visibility" varchar(50) DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "places_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(100) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"reliability_score_internal" integer DEFAULT 70 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"dimension" varchar(50) NOT NULL,
	"canonical_quantity" double precision NOT NULL,
	"notes" text,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "item_aliases" ADD CONSTRAINT "item_aliases_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_item_variant_id_item_variants_id_fk" FOREIGN KEY ("item_variant_id") REFERENCES "public"."item_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers_current" ADD CONSTRAINT "offers_current_item_variant_id_item_variants_id_fk" FOREIGN KEY ("item_variant_id") REFERENCES "public"."item_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers_current" ADD CONSTRAINT "offers_current_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers_current" ADD CONSTRAINT "offers_current_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;