import { Fragment } from "react";

/**
 * A heading that only breaks where its author put a space.
 *
 * Thai is written without spaces between words, so a space in Thai copy marks
 * the end of a phrase. The browser does not know that: it breaks wherever its
 * dictionary finds a word boundary, and `text-wrap: balance` then picks
 * whichever of those makes the lines most even. That is how
 * "ใบหน้าคือข้อมูลอ่อนไหว เราจัดการแบบนี้" came out as "…ข้อมูลอ่อน / ไหว เรา…",
 * with one word cut in half across two lines.
 *
 * Each phrase becomes an inline block, which the line breaker treats as one
 * unbreakable thing. `max-w-full` is the safety valve: a phrase too long for
 * its container on a narrow phone still wraps inside its own box instead of
 * pushing through the edge.
 *
 * English passes through unharmed — every word is its own phrase, so it
 * wraps exactly as it would have anyway.
 */
export function Phrases({ text }: { text: string }) {
  return text.split(" ").map((phrase, index) => (
    <Fragment key={index}>
      {index > 0 && " "}
      <span className="inline-block max-w-full">{phrase}</span>
    </Fragment>
  ));
}
