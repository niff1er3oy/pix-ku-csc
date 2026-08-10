"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";
import { cleanEventCode, EVENT_CODE_LENGTH } from "@/lib/event-code";

export type FindEventState =
  | { error?: "empty" | "not_found" | "unavailable" }
  | undefined;

/**
 * Resolves whatever the visitor typed or pasted into a real event.
 *
 * There is one identifier now. The event's public address *is* its
 * six-character code — `/e/VIC4SI` — so a pasted link and a typed code reduce
 * to the same value, and this no longer has to decide between a slug branch
 * and a code branch or worry that an event's slug might read like somebody
 * else's code.
 */
export async function findEvent(
  _prev: FindEventState,
  formData: FormData,
): Promise<FindEventState> {
  // `q` carries a pasted link. In the ordinary case it is empty and the code
  // arrives as one field per box, which is also what makes the form work with
  // no JavaScript — nothing here depends on the client having assembled
  // anything.
  const raw =
    String(formData.get("q") ?? "").trim() ||
    Array.from({ length: EVENT_CODE_LENGTH }, (_, index) =>
      String(formData.get(`c${index}`) ?? ""),
    ).join("");

  if (!raw) return { error: "empty" };

  const code = cleanEventCode(extractCode(raw));
  if (!code) return { error: "not_found" };

  // Guarded like every read on the landing page. Without this an outage
  // rejects inside a Server Action, which takes down the whole page through
  // the error boundary — so the one visitor who actually holds a code loses
  // their session instead of being told to try again.
  let event: { code: string } | undefined;
  try {
    [event] = await db
      .select({ code: events.accessCode })
      .from(events)
      .where(
        and(
          eq(events.status, "approved"),
          // Compared upper-cased on both sides rather than as stored, and that
          // is the only liberty taken with it: the alphabet has no lower-case
          // members, so casing cannot distinguish two codes. Nothing else
          // about what was typed is reinterpreted.
          sql`upper(${events.accessCode}) = ${code}`,
        ),
      )
      .limit(1);
  } catch (error) {
    console.warn("[pix-ku-csc] event lookup failed:", error);
    return { error: "unavailable" };
  }

  if (!event) return { error: "not_found" };

  redirect(`/e/${event.code}`);
}

/**
 * Pulls the code out of whatever was pasted.
 *
 * Group chats mangle links — tracking params, a trailing full stop, a missing
 * scheme, an invisible character from a copy — so this is deliberately
 * forgiving. Anything that is not a link is handed back untouched for
 * `cleanEventCode` to judge.
 */
function extractCode(input: string): string {
  const value = input.trim();
  if (!value.includes("/")) return value;

  const match = value.match(/\/e\/([^/?#\s]+)/i);
  const tail = match ? match[1] : value.split(/[/?#]/).filter(Boolean).pop();
  return (tail ?? "").replace(/[.,)\]]+$/, "");
}
