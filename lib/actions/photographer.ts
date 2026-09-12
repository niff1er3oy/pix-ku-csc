"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db } from "@/db";
import { photographers } from "@/db/schema";
import { getSessionUser } from "@/lib/dal";
import { notifyAdmins } from "@/lib/notifications";

const ApplicationSchema = z.object({
  bio: z.string().trim().max(600).optional(),
  contactPhone: z.string().trim().max(40).optional(),
});

export type ApplyState =
  | { error: "unauthorized" | "invalid" | "duplicate" }
  | undefined;

/**
 * Applications land as `pending`. Nothing here grants the photographer role —
 * an admin does that on approval — so a successful submit only ever creates a
 * request, never a capability.
 */
export async function applyAsPhotographer(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const user = await getSessionUser();
  if (!user) return { error: "unauthorized" };

  const parsed = ApplicationSchema.safeParse({
    bio: formData.get("bio"),
    contactPhone: formData.get("contactPhone"),
  });

  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  // Neither the display name nor the contact email is its own form field —
  // the Google account already has both, and asking someone to retype a
  // name and address that are sitting right there was friction with nothing
  // behind it. An admin can still edit the display name later from the
  // directory's own "make photographer" form, which is where a name that
  // genuinely needs to differ from the account's actually gets typed.
  const displayName = user.name?.trim() || user.email || "Photographer";

  try {
    await db.insert(photographers).values({
      userId: user.id,
      displayName,
      bio: data.bio || null,
      contactEmail: user.email,
      contactPhone: data.contactPhone || null,
    });
  } catch {
    // `photographer.user_id` is unique — one application per account.
    return { error: "duplicate" };
  }

  await notifyAdmins({
    type: "photographer_application_received",
    href: "/admin",
    data: { name: displayName },
  });

  revalidatePath("/photographer/apply");
  redirect("/photographer/apply");
}
