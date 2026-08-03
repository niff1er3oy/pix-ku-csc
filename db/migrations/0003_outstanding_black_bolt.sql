ALTER TABLE "event" ALTER COLUMN "access_code" SET DEFAULT gen_event_code();--> statement-breakpoint
ALTER TABLE "event" ALTER COLUMN "access_code" SET NOT NULL;