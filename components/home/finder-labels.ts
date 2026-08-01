import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Only the five strings EventFinder renders. Handing it the whole dictionary
 * would serialise every string in the app into the RSC payload for a component
 * that shows one label and one button — a real cost on the venue wifi this
 * product runs on. Narrowing it here halved the landing page's HTML.
 *
 * This lives in its own plain module rather than beside the component: every
 * export from a `"use client"` file becomes a client reference, so a Server
 * Component cannot call a function declared there.
 */
export type FinderLabels = Pick<
  Dictionary["home"],
  | "finderLabel"
  | "finderPlaceholder"
  | "finderSubmit"
  | "finderNotFound"
  | "finderEmpty"
>;

export function pickFinderLabels(dict: Dictionary): FinderLabels {
  const {
    finderLabel,
    finderPlaceholder,
    finderSubmit,
    finderNotFound,
    finderEmpty,
  } = dict.home;

  return {
    finderLabel,
    finderPlaceholder,
    finderSubmit,
    finderNotFound,
    finderEmpty,
  };
}
