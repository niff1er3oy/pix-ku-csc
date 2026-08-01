"use server";

import { and, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";

export type FindEventState = { error?: "empty" | "not_found" } | undefined;

/**
 * Resolves whatever the visitor pasted into the hero into a real event, then
 * redirects. It looks the slug up *before* navigating on purpose: sending
 * someone to a URL that turns out not to exist would answer a mistyped code
 * with a 404 page, when the field they typed into is right there to correct.
 *
 * Accepts a full shared URL, a bare slug, or an access code — those are the
 * three things a visitor actually has in hand.
 */
export async function findEvent(
  _prev: FindEventState,
  formData: FormData,
): Promise<FindEventState> {
  const raw = String(formData.get("q") ?? "").trim();
  if (!raw) return { error: "empty" };

  const slug = extractSlug(raw);
  if (!slug) return { error: "not_found" };

  const [event] = await db
    .select({ slug: events.slug })
    .from(events)
    .where(
      and(
        eq(events.status, "approved"),
        or(eq(events.slug, slug), eq(events.accessCode, raw)),
      ),
    )
    .limit(1);

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
