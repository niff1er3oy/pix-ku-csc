CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('biometric_search', 'biometric_storage', 'terms', 'privacy');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."index_status" AS ENUM('pending', 'indexing', 'indexed', 'no_face', 'failed');--> statement-breakpoint
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
CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_th" text NOT NULL,
	"name_en" text,
	"description_th" text,
	"description_en" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"owner_id" uuid NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"face_collection_id" text,
	"cover_photo_id" uuid,
	"is_unlisted" boolean DEFAULT false NOT NULL,
	"access_code" text,
	"watermark_enabled" boolean DEFAULT false NOT NULL,
	"watermark_text" text,
	"watermark_logo_path" text,
	"watermark_position" "watermark_position" DEFAULT 'bottom_right' NOT NULL,
	"watermark_opacity" integer DEFAULT 60 NOT NULL,
	"watermark_scale" integer DEFAULT 18 NOT NULL,
	"allow_original_download" boolean DEFAULT true NOT NULL,
	"photo_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug")
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
	"affiliation" text,
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
ALTER TABLE "consent" ADD CONSTRAINT "consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_owner_id_photographer_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."photographer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_face" ADD CONSTRAINT "photo_face_photo_id_photo_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_face" ADD CONSTRAINT "photo_face_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer" ADD CONSTRAINT "photographer_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo" ADD CONSTRAINT "photo_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search" ADD CONSTRAINT "search_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search" ADD CONSTRAINT "search_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_face" ADD CONSTRAINT "user_face_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_user_idx" ON "consent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_anon_idx" ON "consent" USING btree ("anonymous_id");--> statement-breakpoint
CREATE INDEX "download_photo_idx" ON "download" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "event_status_idx" ON "event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_owner_idx" ON "event" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "event_starts_at_idx" ON "event" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "photo_face_photo_idx" ON "photo_face" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photo_face_event_idx" ON "photo_face" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photographer_status_idx" ON "photographer" USING btree ("status");--> statement-breakpoint
CREATE INDEX "photo_event_idx" ON "photo" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "photo_index_status_idx" ON "photo" USING btree ("index_status");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_event_checksum_idx" ON "photo" USING btree ("event_id","checksum");--> statement-breakpoint
CREATE INDEX "search_event_idx" ON "search" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "search_user_idx" ON "search" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "search_created_idx" ON "search" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_face_user_idx" ON "user_face" USING btree ("user_id");