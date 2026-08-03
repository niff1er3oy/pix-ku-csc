-- The event code is issued by the database, not by the application.
--
-- Putting it here rather than in Node means a row cannot exist without a code
-- no matter what writes it — a seed script, a migration, someone at a psql
-- prompt. The code is the only way a visitor reaches an unlisted event, so an
-- event that quietly ended up without one would be an event nobody can find.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

-- Six characters from the full 36-character alphabet.
--
-- `gen_random_bytes` and not `random()`: `random()` is a pseudo-random
-- generator whose sequence can be predicted from earlier output, and this
-- value is the only gate on an unlisted event's photographs. pgcrypto's is a
-- CSPRNG.
--
-- The `< 252` test is rejection sampling and is not optional. 256 is not a
-- multiple of 36, so taking `byte % 36` across the whole byte range would make
-- the first four characters of the alphabet turn up more often than the rest —
-- a small bias, but bias in exactly the value that has to be unguessable.
-- 252 is floor(256 / 36) * 36, so every accepted byte is uniform over 36.
--
-- The outer loop keeps the function from handing back a code already in use.
-- Two concurrent transactions can still land on the same unused code, which is
-- what the unique index on event.access_code is for; this only makes reaching
-- that path rare rather than merely unlikely.
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
$$;
--> statement-breakpoint

-- Any row that predates the default needs one before NOT NULL can be applied.
UPDATE "event" SET access_code = gen_event_code() WHERE access_code IS NULL;
--> statement-breakpoint

-- Shape is enforced here as well as generated here. The application still
-- parses codes with `cleanEventCode` in lib/event-code.ts, and this constraint
-- is what stops the two from drifting apart: a code that does not match cannot
-- be stored, whichever side wrote it.
ALTER TABLE "event"
  ADD CONSTRAINT "event_access_code_shape"
  CHECK (access_code ~ '^[A-Z0-9]{6}$');
