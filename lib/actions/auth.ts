"use server";

import { signOut } from "@/auth";

/** Wraps `signOut` so it can sit directly on a `<form action>` — the
 *  exported `signOut` itself takes an options object, not `FormData`. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
