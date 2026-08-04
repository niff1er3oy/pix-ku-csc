"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
 * It is submitted as one hidden field rather than six named boxes. The server
 * hashes it, so there is no version of this that works without JavaScript —
 * unlike the visitor-facing code entry, where the boxes each carry their own
 * name for exactly that reason.
 */
export function PinField({
  labels,
  enabled,
}: {
  labels: Dictionary["studio"];
  enabled: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(SLOTS.map(() => ""));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const value = digits.join("");

  const focusSlot = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(LENGTH - 1, index))];
    box?.focus();
    box?.select();
  };

  const write = (index: number, next: string) =>
    setDigits((current) => {
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
    setDigits(pin.split(""));
  };

  if (!enabled) return null;

  return (
    <div className="mt-4 border-t border-edge pt-4">
      <p className="text-label font-medium text-ink">{labels.formPin}</p>
      <p className="mt-1 text-caption text-slate">{labels.formPinHint}</p>

      <input type="hidden" name="entryPin" value={value} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
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
                  setDigits((current) => {
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
              className="tnum h-14 w-11 rounded-field bg-paper text-center font-display text-xl font-semibold text-ink ring-1 ring-inset ring-edge focus:ring-2 focus:ring-green-600 sm:w-12"
            />
          ))}
        </div>

        <Button type="button" variant="secondary" size="md" onClick={randomise}>
          {labels.formPinRandom}
        </Button>
      </div>
    </div>
  );
}
