CREATE TABLE "affiliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliation_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
ALTER TABLE "event" ADD COLUMN "affiliation_id" uuid;--> statement-breakpoint
ALTER TABLE "photographer" ADD COLUMN "affiliation_id" uuid;--> statement-breakpoint
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_affiliation_id_affiliation_id_fk" FOREIGN KEY ("affiliation_id") REFERENCES "public"."affiliation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_affiliation_id_affiliation_id_fk" FOREIGN KEY ("affiliation_id") REFERENCES "public"."affiliation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_affiliation_idx" ON "event" USING btree ("affiliation_id");--> statement-breakpoint
CREATE INDEX "photographer_affiliation_idx" ON "photographer" USING btree ("affiliation_id");