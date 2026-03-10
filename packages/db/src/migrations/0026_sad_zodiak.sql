CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid,
	"scope" text DEFAULT 'global' NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_by_agent_id" uuid,
	"updated_by_agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_updated_by_agent_id_agents_id_fk" FOREIGN KEY ("updated_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_company_idx" ON "memories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "memories_scope_ns_key_idx" ON "memories" USING btree ("company_id","scope","namespace","key");--> statement-breakpoint
CREATE INDEX "memories_agent_idx" ON "memories" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "memories_namespace_idx" ON "memories" USING btree ("company_id","namespace");