CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"tailscale_ip" text,
	"role" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"capabilities" jsonb,
	"services" jsonb,
	"projects" jsonb,
	"skills" jsonb,
	"last_seen_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machines_company_hostname_uniq" UNIQUE("company_id","hostname")
);
--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machines_company_idx" ON "machines" USING btree ("company_id");