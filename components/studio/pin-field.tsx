"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { RefreshIcon } from "@/components/ui/icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";

const LENGTH = 6;
const SLOTS = Array.from({ length: LENGTH }, (_, index) => index);

/**
 * The entry PIN for a private event: six digits, typed or generated.
 *
 * Revealed by the "private event" switch rather than shown always, because on
 * a public event it is not an option that happens to be off — it is a field
 * that does not apply.
 *
 * Digits only, and `inputMode="numeric"` so a phone opens the number pad. This
 * is not the same value as the event code above it: that one is the address,
 * six characters of letters and digits, issued by the database. This is the
 * gate, and the photographer owns it.
 *
 * It is submitted as one hidden field rather than six named boxes — there is
 * no version of this that works without JavaScript, unlike the
 * visitor-facing code entry, where the boxes each carry their own name for
 * exactly that reason.
 */
export function PinField({
  labels,
  enabled,
  initialValue,
  onChange,
}: {
  labels: Dictionary["studio"];
  enabled: boolean;
  /** The event's current PIN, if it already has one — prefills the boxes so
   *  opening settings shows it rather than six empty slots. */
  initialValue?: string;
  /** Fires with the joined digit string on every change — lets a parent show
   *  a live "you still need a PIN" notice before the round trip to the
   *  server would otherwise be the first place that showed up. */
  onChange?: (value: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => {
    const chars = (initialValue ?? "").split("");
    return SLOTS.map((index) => chars[index] ?? "");
  });
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const value = digits.join("");

  // Reports every change to the parent from an effect rather than from
  // inside the `setDigits` updater below. React can invoke that updater
  // outside a genuine event (Strict Mode's extra pass, a delayed
  // re-render), and calling a *different* component's setter — `onChange`
  // ultimately is one, in `EventInfoForm` — from inside it is exactly what
  // trips "Cannot update a component while rendering a different
  // component."
  useEffect(() => {
    onChange?.(value);
    // Only the joined value matters here — re-running this because
    // `onChange` got a new identity from its own parent re-rendering would
    // just report the same value again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const focusSlot = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(LENGTH - 1, index))];
    box?.focus();
    box?.select();
  };

  /** Every update to `digits` — typed, pasted, backspaced, or randomised —
   *  goes through this. */
  const apply = (next: (current: string[]) => string[]) => setDigits(next);

  const write = (index: number, next: string) =>
    apply((current) => {
      const copy = [...current];
      copy[index] = next;
      return copy;
    });

  /**
   * `Math.random` would be wrong here even for a suggestion: whatever this
   * produces is what most photographers will keep, so it is the real PIN. The
   * server generates it with `randomInt` — this asks for one rather than
   * inventing it in the browser.
   */
  const randomise = async () => {
    const response = await fetch("/api/studio/pin", { method: "POST" });
    if (!response.ok) return;
    const { pin } = (await response.json()) as { pin: string };
    apply(() => pin.split(""));
  };

  if (!enabled) return null;

  return (
    <div className="mt-4 border-t border-edge pt-4">
      <p className="text-label font-medium text-ink">{labels.formPin}</p>
      <p className="mt-1 text-caption text-slate">{labels.formPinHint}</p>

      <input type="hidden" name="entryPin" value={value} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* `overflow-x-auto`, not a narrower box or a tighter gap: six boxes
            at the 44px floor plus the tightest gap already in use (`gap-1`,
            4px) add up to 284px, and this field lands inside more padding
            than `EventCodeInput` budgeted for on the public entry page — on
            the settings page specifically, nested inside the cloud form's
            own `p-5`, only 280px of it are left at a 360px viewport. Shrinking
            a box below 44px to make it fit would cost exactly the touch
            target DESIGN.md's scrollbar section already argues is worth more
            than a few pixels of tidiness; a contained 4px scroll costs
            nothing and is never seen at any width this field actually ships
            at outside that one nesting. */}
        <div className="flex items-center gap-1 overflow-x-auto sm:gap-2">
          {SLOTS.map((index) => (
            <input
              key={index}
              ref={(node) => {
                boxes.current[index] = node;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={1}
              aria-label={labels.formPinSlot
                .replace("{n}", String(index + 1))
                .replace("{total}", String(LENGTH))}
              value={digits[index]}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const raw = event.target.value.replace(/\D/g, "");
                if (raw.length > 1) {
                  const spread = raw.slice(0, LENGTH - index).split("");
                  apply((current) => {
                    const copy = [...current];
                    spread.forEach((d, offset) => {
                      if (index + offset < LENGTH) copy[index + offset] = d;
                    });
                    return copy;
                  });
                  focusSlot(index + spread.length);
                  return;
                }
                write(index, raw);
                if (raw) focusSlot(index + 1);
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && digits[index] === "") {
                  event.preventDefault();
                  write(Math.max(0, index - 1), "");
                  focusSlot(index - 1);
                }
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  focusSlot(index - 1);
                }
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  focusSlot(index + 1);
                }
              }}
              className="tnum h-14 w-11 shrink-0 rounded-field bg-paper text-center font-display text-xl font-semibold text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-green-600 sm:w-12"
            />
          ))}
        </div>

        <Button type="button" variant="secondary" size="md" onClick={randomise}>
          <RefreshIcon size={16} />
          {labels.formPinRandom}
        </Button>
      </div>
    </div>
  );
}
