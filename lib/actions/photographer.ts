"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { db } from "@/db";
import { photographers } from "@/db/schema";
import { getSessionUser } from "@/lib/dal";
import { notifyAdmins } from "@/lib/notifications";

const ApplicationSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  affiliation: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(600).optional(),
  contactEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
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
    displayName: formData.get("displayName"),
    affiliation: formData.get("affiliation"),
    bio: formData.get("bio"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
  });

  if (!parsed.success) return { error: "invalid" };
  const data = parsed.data;

  try {
    await db.insert(photographers).values({
      userId: user.id,
      displayName: data.displayName,
      affiliation: data.affiliation || null,
      bio: data.bio || null,
      contactEmail: data.contactEmail || user.email,
      contactPhone: data.contactPhone || null,
    });
  } catch {
    // `photographer.user_id` is unique — one application per account.
    return { error: "duplicate" };
  }

  await notifyAdmins({
    type: "photographer_application_received",
    href: "/admin",
    data: { name: data.displayName },
  });

  revalidatePath("/photographer/apply");
  redirect("/photographer/apply");
}
