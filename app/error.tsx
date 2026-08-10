"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

import { dictionaries } from "@/lib/i18n/dictionaries";

const NO_SUBSCRIBE = () => () => {};

/**
 * In-system error boundary. Without it a failing query drops the visitor onto
 * Next's stock error screen — English, off-brand, and with no way back.
 *
 * An error boundary must be a Client Component, so it cannot await the server
 * locale. The dictionary is plain data, so it reads the language off the html
 * element the server already rendered.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The locale differs between the server render and the client, which is
  // exactly what useSyncExternalStore's server snapshot exists for — a plain
  // effect would set state after paint and trip a hydration mismatch.
  const lang = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => document.documentElement.lang,
    () => "th",
  );
  const dict = lang === "en" ? dictionaries.en : dictionaries.th;

  useEffect(() => {
    console.error("[pix-ku-csc] route error:", error);
  }, [error]);

  const button =
    "h-14 rounded-pill px-8 font-display text-base font-semibold transition-[background-color,transform] duration-200 active:scale-[0.98]";

  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="w-full max-w-lg rounded-card bg-cloud px-6 py-14 text-center sm:py-16">
        <h1 className="text-h2">{dict.common.errorTitle}</h1>
        <p className="mx-auto mt-3 max-w-sm text-body text-slate">
          {dict.common.errorBody}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className={`${button} bg-green-600 text-paper shadow-[var(--shadow-pop)] hover:bg-green-700`}
          >
            {dict.common.retry}
          </button>
          <Link
            href="/"
            className={`${button} flex items-center justify-center bg-paper text-green-700 ring-1 ring-inset ring-edge hover:bg-green-50`}
          >
            {dict.common.goHome}
          </Link>
        </div>

        {error.digest && (
          <p className="tnum mt-8 text-caption text-slate">{error.digest}</p>
        )}
      </div>
    </main>
  );
}
