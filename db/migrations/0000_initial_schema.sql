CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
-- Six characters from the full 36-character alphabet, drawn with a CSPRNG
-- rather than `random()` — this is the only gate on an unlisted event's
-- photographs. The `< 252` rejection sampling keeps the 256-value byte range
-- from biasing toward the first four characters of a 36-character alphabet
-- (252 = floor(256 / 36) * 36, so every accepted byte is uniform over 36).
-- The outer loop avoids handing back a code already in use; the unique index
-- on event.access_code is what makes the rare concurrent collision safe.
CREATE OR REPLACE FUNCTION gen_event_code() RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet CONSTANT text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  cutoff   CONSTANT int  := 252;
  candidate text;
  byte int;
BEGIN
  LOOP
    candidate := '';

    WHILE length(candidate) < 6 LOOP
      byte := get_byte(gen_random_bytes(1), 0);
      CONTINUE WHEN byte >= cutoff;
      candidate := candidate || substr(alphabet, (byte % 36) + 1, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM "event" WHERE access_code = candidate
    );
  END LOOP;

  RETURN candidate;
END;
$$;--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('biometric_search', 'biometric_storage', 'terms', 'privacy');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."index_status" AS ENUM('pending', 'indexing', 'indexed', 'no_face', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('photographer_application_received', 'photographer_approved', 'photographer_rejected', 'photographer_granted', 'photographer_revoked', 'event_approved', 'event_rejected', 'photo_index_failed', 'photo_downloaded', 'affiliation_member_added', 'affiliation_member_removed');--> statement-breakpoint
CREATE TYPE "public"."search_mode" AS ENUM('saved_face', 'uploaded_selfie');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'photographer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."watermark_position" AS ENUM('bottom_right', 'bottom_left', 'top_right', 'top_left', 'center', 'tiled');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "affiliation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"join_code" text NOT NULL,
	"image_path" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliation_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anonymous_id" text,
	"type" "consent_type" NOT NULL,
	"version" text NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_hash" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "download" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"user_id" uuid,
	"watermarked" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_pin_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"description_th" text,
	"description_en" text,
	"location" text,
	"event_date" date NOT NULL,
	"owner_id" uuid NOT NULL,
	"affiliation_id" uuid,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"face_collection_id" text,
	"cover_path" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"entry_pin" text,
	"access_code" text DEFAULT gen_event_code() NOT NULL,
	"watermark_enabled" boolean DEFAULT false NOT NULL,
	"watermark_text" text,
	"watermark_logo_path" text,
	"watermark_position" "watermark_position" DEFAULT 'bottom_right' NOT NULL,
	"watermark_opacity" integer DEFAULT 60 NOT NULL,
	"watermark_scale" integer DEFAULT 18 NOT NULL,
	"allow_original_download" boolean DEFAULT true NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"href" text,
	"data" jsonb,
	"dedup_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_face" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"face_id" text NOT NULL,
	"bounding_box" jsonb,
	"confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_face_face_id_unique" UNIQUE("face_id")
);
--> statement-breakpoint
CREATE TABLE "photographer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"contact_email" text,
	"contact_phone" text,
	"affiliation_id" uuid,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photographer_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"original_path" text NOT NULL,
	"preview_path" text NOT NULL,
	"thumb_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"captured_at" timestamp with time zone,
	"index_status" "index_status" DEFAULT 'pending' NOT NULL,
	"index_error" text,
	"face_count" integer DEFAULT 0 NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_hidden_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_match" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"face_id" text NOT NULL,
	"similarity" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid,
	"mode" "search_mode" NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"top_similarity" real,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_face" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"image_path" text NOT NULL,
	"quality" jsonb,
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"locale" text DEFAULT 'th' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliation" ADD CONSTRAINT "affiliation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_pin_attempt" ADD CONSTRAINT "event_pin_attempt_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_owner_id_photographer_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."photographer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_affiliation_id_affiliation_id_fk" FOREIGN KEY ("affiliation_id") REFERENCES "public"."affiliation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Shape is enforced here as well as generated in `gen_event_code()`. The
-- application still parses codes with `cleanEventCode` in lib/event-code.ts,
-- and this constraint is what stops the two from drifting apart.
ALTER TABLE "event" ADD CONSTRAINT "event_access_code_shape" CHECK (access_code ~ '^[A-Z0-9]{6}$');--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_face" ADD CONSTRAINT "photo_face_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_face" ADD CONSTRAINT "photo_face_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_affiliation_id_affiliation_id_fk" FOREIGN KEY ("affiliation_id") REFERENCES "public"."affiliation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_hidden_event" ADD CONSTRAINT "profile_hidden_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_hidden_event" ADD CONSTRAINT "profile_hidden_event_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_photo" ADD CONSTRAINT "saved_photo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_photo" ADD CONSTRAINT "saved_photo_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_match" ADD CONSTRAINT "search_match_search_id_search_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_match" ADD CONSTRAINT "search_match_face_id_photo_face_face_id_fk" FOREIGN KEY ("face_id") REFERENCES "public"."photo_face"("face_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search" ADD CONSTRAINT "search_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search" ADD CONSTRAINT "search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_face" ADD CONSTRAINT "user_face_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_user_idx" ON "consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_anon_idx" ON "consent" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "download_photo_idx" ON "download" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "event_pin_attempt_event_ip_idx" ON "event_pin_attempt" USING btree ("event_id","ip_hash");--> statement-breakpoint
CREATE INDEX "event_status_idx" ON "event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_owner_idx" ON "event" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "event_affiliation_idx" ON "event" USING btree ("affiliation_id");--> statement-breakpoint
CREATE INDEX "event_date_idx" ON "event" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "event_access_code_idx" ON "event" USING btree ("access_code");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_dedup_idx" ON "notification" USING btree ("user_id","dedup_key");--> statement-breakpoint
CREATE INDEX "photo_face_photo_idx" ON "photo_face" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photo_face_event_idx" ON "photo_face" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photographer_status_idx" ON "photographer" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photographer_affiliation_idx" ON "photographer" USING btree ("affiliation_id");--> statement-breakpoint
CREATE INDEX "photo_event_idx" ON "photo" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photo_index_status_idx" ON "photo" USING btree ("index_status");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_event_checksum_idx" ON "photo" USING btree ("event_id","checksum");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_hidden_event_user_event_idx" ON "profile_hidden_event" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "profile_hidden_event_user_idx" ON "profile_hidden_event" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_photo_user_photo_idx" ON "saved_photo" USING btree ("user_id","photo_id");--> statement-breakpoint
CREATE INDEX "saved_photo_user_idx" ON "saved_photo" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_match_search_idx" ON "search_match" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "search_match_face_idx" ON "search_match" USING btree ("face_id");--> statement-breakpoint
CREATE INDEX "search_event_idx" ON "search" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "search_user_idx" ON "search" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_created_idx" ON "search" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_face_user_idx" ON "user_face" USING btree ("user_id");