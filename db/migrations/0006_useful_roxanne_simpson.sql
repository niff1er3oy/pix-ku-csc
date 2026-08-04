DROP INDEX "event_starts_at_idx";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "starts_at";--> statement-breakpoint
ALTER TABLE "event" DROP COLUMN "ends_at";