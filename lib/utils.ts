import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Thai-friendly date formatting. Thai uses the Buddhist era by default. */
export function formatDate(
  date: Date | string,
  locale: "th" | "en",
  opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(
    locale === "th" ? "th-TH" : "en-GB",
    { timeZone: "Asia/Bangkok", ...opts },
  ).format(d);
}

export function formatNumber(n: number, locale: "th" | "en") {
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB").format(n);
}

/**
 * The ring color around a member's avatar wherever a photographer can see
 * one — the same distinction a role chip would make, carried onto the
 * avatar itself instead: a member is who most rows are (light green), a
 * photographer is the account actually running the event (dark green), and
 * an admin is staff, not a participant (red).
 */
export function avatarRingClass(role: "user" | "photographer" | "admin") {
  switch (role) {
    case "admin":
      return "ring-2 ring-danger";
    case "photographer":
      return "ring-2 ring-green-700";
    default:
      return "ring-2 ring-green-300";
  }
}

/** URL-safe slug that keeps Thai characters intact. */
export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    // `\p{M}` is not optional here. Thai vowels and tone marks are combining
    // marks, not letters, so a set of `\p{L}\p{N}` alone strips them — it
    // turned "งานกีฬาสีทดสอบ" into "งานกฬาสทดสอบ", which is not a word. The
    // slug is the public URL and the QR's destination, so it has to survive as
    // readable Thai.
    .replace(/[^\p{L}\p{N}\p{M}-]+/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
