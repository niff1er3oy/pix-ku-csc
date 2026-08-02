"use client";

import { useRef, useState } from "react";

import { EVENT_CODE_ALPHABET, EVENT_CODE_LENGTH } from "@/lib/event-code";
import { normaliseEventCode } from "@/lib/event-code";
import { cn } from "@/lib/utils";

const SLOTS = Array.from({ length: EVENT_CODE_LENGTH }, (_, index) => index);
const EMPTY = SLOTS.map(() => "");

/** A pasted link is the only input that carries these. */
const LOOKS_LIKE_LINK = /[/:]/;

/**
 * Six boxes, one character each.
 *
 * Two things about this are load-bearing and easy to lose in a refactor:
 *
 * **It still accepts a pasted link.** The field this replaced took an event
 * URL as well as a code, and people do arrive holding a link somebody
 * forwarded them. Six one-character boxes cannot show a URL, so a paste that
 * is a link instead of a code is put straight into the hidden field and the
 * form is submitted — the visitor pasted an event link into the only input on
 * screen, and there is no other thing they could have meant.
 *
 * **It still works without JavaScript.** Each box submits its own `c0`…`c5`,
 * which the server action reassembles when `q` is empty. Without that, six
 * unnamed boxes plus an unfilled hidden field would post nothing at all, and
 * the one visitor whose bundle failed on venue wifi would be locked out of the
 * only way into their photographs.
 *
 * Segmented inputs are usually hostile to screen readers because they present
 * as six unrelated textboxes. Here they are wrapped in a labelled group and
 * each box states which position it is, so the field announces as one thing
 * with six parts rather than six mysteries.
 */
export function EventCodeInput({
  label,
  invalid,
  describedBy,
  slotLabel,
}: {
  /** Id of the visible label this group belongs to. */
  label: string;
  invalid: boolean;
  describedBy: string;
  /** e.g. "ตัวที่ {n} จาก {total}" — announced per box. */
  slotLabel: string;
}) {
  const [chars, setChars] = useState<string[]>(EMPTY);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const hidden = useRef<HTMLInputElement>(null);

  const focusSlot = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(EVENT_CODE_LENGTH - 1, index))];
    box?.focus();
    box?.select();
  };

  /** Hands the raw text to the server action as-is and goes. */
  const submitRaw = (raw: string, form: HTMLFormElement | null) => {
    if (!hidden.current || !form) return;
    // Written to the DOM node rather than through state: `requestSubmit`
    // reads the form on this tick, before React would have re-rendered.
    hidden.current.value = raw;
    form.requestSubmit();
  };

  const write = (index: number, next: string) => {
    setChars((current) => {
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  };

  return (
    <div
      role="group"
      aria-labelledby={label}
      aria-describedby={describedBy}
      /* `gap-1` on a phone is not a style choice. Six boxes at the 44px floor
         in DESIGN.md §9 need 264px before any gap at all, and a 360px screen
         leaves 288px inside the card — so the gap is what is left over, and
         anything more generous pushes the boxes under the floor. It opens up
         from `sm` where the room exists. */
      className="flex items-center gap-1 sm:gap-2"
    >
      {/* Carries a pasted link. Empty in the ordinary case, where the boxes
          below submit their own values instead. */}
      <input ref={hidden} type="hidden" name="q" defaultValue="" />

      {SLOTS.map((index) => (
        <input
          key={index}
          ref={(node) => {
            boxes.current[index] = node;
          }}
          name={`c${index}`}
          type="text"
          value={chars[index]}
          // `maxLength` alone is not enough — it does not stop a paste or an
          // IME commit, both of which are handled below.
          maxLength={1}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-label={slotLabel
            .replace("{n}", String(index + 1))
            .replace("{total}", String(EVENT_CODE_LENGTH))}
          aria-invalid={invalid || undefined}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const raw = event.target.value;

            // A phone keyboard can commit several characters at once, and some
            // Android IMEs deliver a paste through `change` rather than
            // `paste`. Treat anything longer than one character as a fill.
            if (raw.length > 1) {
              distribute(raw, index, setChars, focusSlot, (value) =>
                submitRaw(value, event.currentTarget.form),
              );
              return;
            }

            const character = raw.toUpperCase();
            if (character !== "" && !EVENT_CODE_ALPHABET.includes(character)) {
              // Rejected rather than shown: I, L and O are not in the alphabet,
              // but they are what a person types when the poster showed 1, 1
              // and 0, so they are folded instead of refused.
              const folded = { I: "1", L: "1", O: "0" }[character];
              if (!folded) return;
              write(index, folded);
              focusSlot(index + 1);
              return;
            }

            write(index, character);
            if (character !== "") focusSlot(index + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && chars[index] === "") {
              // Nothing here to delete, so the intent is the box before.
              event.preventDefault();
              write(index - 1 < 0 ? 0 : index - 1, "");
              focusSlot(index - 1);
              return;
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
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text");
            distribute(text, index, setChars, focusSlot, (value) =>
              submitRaw(value, event.currentTarget.form),
            );
          }}
          className={cn(
            // `flex-1` with `min-w-0` rather than a fixed width: six fixed
            // boxes plus gaps overflow a 360px phone, which is a real width at
            // a Thai campus event.
            "tnum h-14 min-w-0 flex-1 rounded-field bg-paper text-center font-display text-xl font-semibold uppercase text-ink ring-1 ring-inset ring-edge transition-shadow duration-200 focus:ring-2 focus:ring-green-600",
            invalid && "ring-danger",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Spreads pasted text across the boxes from `start`, or hands a link straight
 * to the form.
 */
function distribute(
  text: string,
  start: number,
  setChars: React.Dispatch<React.SetStateAction<string[]>>,
  focusSlot: (index: number) => void,
  submitRaw: (raw: string) => void,
) {
  const trimmed = text.trim();

  // A link cannot be shown in six one-character boxes, so it goes to the
  // server as it is rather than being silently dropped.
  if (LOOKS_LIKE_LINK.test(trimmed)) {
    submitRaw(trimmed);
    return;
  }

  // A complete code pasted anywhere fills the whole row from the start,
  // regardless of which box happened to have focus.
  const whole = normaliseEventCode(trimmed);
  if (whole) {
    setChars(whole.split(""));
    focusSlot(EVENT_CODE_LENGTH - 1);
    return;
  }

  // A fragment fills forward from wherever the caret was.
  const usable = trimmed
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[ILO]/g, (character) => ({ I: "1", L: "1", O: "0" })[character]!)
    .split("")
    .filter((character) => EVENT_CODE_ALPHABET.includes(character));

  if (usable.length === 0) return;

  setChars((current) => {
    const copy = [...current];
    usable.forEach((character, offset) => {
      const slot = start + offset;
      if (slot < EVENT_CODE_LENGTH) copy[slot] = character;
    });
    return copy;
  });
  focusSlot(start + usable.length);
}
