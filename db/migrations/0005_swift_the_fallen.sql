ALTER TABLE "event" ADD COLUMN "event_date" date NOT NULL;--> statement-breakpoint
CREATE INDEX "event_date_idx" ON "event" USING btree ("event_date");