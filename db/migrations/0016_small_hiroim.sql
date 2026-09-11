CREATE TABLE "profile_hidden_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_hidden_event" ADD CONSTRAINT "profile_hidden_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_hidden_event" ADD CONSTRAINT "profile_hidden_event_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_hidden_event_user_event_idx" ON "profile_hidden_event" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "profile_hidden_event_user_idx" ON "profile_hidden_event" USING btree ("user_id");