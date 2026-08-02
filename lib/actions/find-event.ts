"use server";

import { and, eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";
import { EVENT_CODE_LENGTH, normaliseEventCode } from "@/lib/event-code";

export type FindEventState =
  | { error?: "empty" | "not_found" | "unavailable" }
  | undefined;

/**
 * Resolves whatever the visitor pasted into the hero into a real event, then
 * redirects. It looks the slug up *before* navigating on purpose: sending
 * someone to a URL that turns out not to exist would answer a mistyped code
 * with a 404 page, when the field they typed into is right there to correct.
 *
 * Accepts a full shared URL, a bare slug, or a six-character event code —
 * those are the three things a visitor actually has in hand. The code's shape
 * and the forgiveness applied to it live in lib/event-code.ts.
 */
export async function findEvent(
  _prev: FindEventState,
  formData: FormData,
): Promise<FindEventState> {
  // `q` carries a pasted link. In the ordinary case it is empty and the code
  // arrives as one field per box, which is also what makes the form work with
  // no JavaScript at all — nothing here depends on the client having
  // assembled anything.
  const raw =
    String(formData.get("q") ?? "").trim() ||
    Array.from({ length: EVENT_CODE_LENGTH }, (_, index) =>
      String(formData.get(`c${index}`) ?? ""),
    ).join("");

  if (!raw) return { error: "empty" };

  // A six-character code is checked first and on its own. If it were folded
  // into the slug branch, a code would also be tried as a slug, and an event
  // whose slug happened to read like somebody else's code would open the
  // wrong gallery — of photographs of people who never agreed to be found
  // that way.
  const code = normaliseEventCode(raw);
  const slug = code ? null : extractSlug(raw);
  if (!code && !slug) return { error: "not_found" };

  // Guarded like every read on the landing page. Without this an outage
  // rejects inside a Server Action, which takes down the whole page through
  // the error boundary — so the one visitor who actually holds a code loses
  // their session instead of being told to try again.
  let event: { slug: string } | undefined;
  try {
    [event] = await db
      .select({ slug: events.slug })
      .from(events)
      .where(
        and(
          eq(events.status, "approved"),
          code
            ? // Compared upper-cased on both sides rather than as stored. A
              // code read off a poster gets typed however the phone's
              // keyboard felt like it, and every row predating the generator
              // in lib/event-code.ts could hold any casing at all.
              sql`upper(${events.accessCode}) = ${code}`
            : or(eq(events.slug, slug!), eq(events.accessCode, raw)),
        ),
      )
      .limit(1);
  } catch (error) {
    console.warn("[find-ku-dae] event lookup failed:", error);
    return { error: "unavailable" };
  }

  if (!event) return { error: "not_found" };

  redirect(`/e/${event.slug}`);
}

/**
 * Pulls the slug out of a pasted link. Group chats mangle URLs — tracking
 * params, trailing punctuation, a missing scheme — so this is deliberately
 * forgiving rather than strict.
 */
function extractSlug(input: string): string | null {
  let value = input;

  if (value.includes("/")) {
    const match = value.match(/\/e\/([^/?#\s]+)/);
    value = match ? match[1] : value.split("/").filter(Boolean).pop() || "";
  }

  value = value.replace(/[?#].*$/, "").replace(/[.,)\]]+$/, "").trim();

  // Slugs may contain Thai, so validate by what is *not* allowed.
  if (!value || /[\s/\\<>"']/.test(value)) return null;
  return value.slice(0, 120);
}
