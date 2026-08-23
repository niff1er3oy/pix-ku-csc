CREATE TABLE "search_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"face_id" text NOT NULL,
	"similarity" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_match" ADD CONSTRAINT "search_match_search_id_search_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_match" ADD CONSTRAINT "search_match_face_id_photo_face_face_id_fk" FOREIGN KEY ("face_id") REFERENCES "public"."photo_face"("face_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_match_search_idx" ON "search_match" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "search_match_face_idx" ON "search_match" USING btree ("face_id");