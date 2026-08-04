import { cn } from "@/lib/utils";

/**
 * A signed-in person's picture.
 *
 * **`referrerPolicy="no-referrer"` is what makes this work at all, and it is
 * not a preference.** Google serves avatars from `lh3.googleusercontent.com`,
 * and when the request carries a `Referer` its CDN answers with something
 * Chrome's Opaque Response Blocking refuses to hand to an `<img>` —
 * `net::ERR_BLOCKED_BY_ORB`, a silent failure with a 200 in the network log
 * and `naturalWidth === 0` on the element. Measured, in a real browser:
 *
 *   | attributes                                     | result  |
 *   | (none)                                         | blocked |
 *   | crossorigin="anonymous"                        | blocked |
 *   | referrerpolicy="no-referrer"                   | loads   |
 *   | referrerpolicy="no-referrer" + crossorigin     | loads   |
 *
 * The referrer is the deciding factor and `crossorigin` changes nothing, so
 * only the one that matters is set.
 *
 * This exists as a component rather than as an attribute on one `<img>` so the
 * next place that shows a face — the profile page, a photographer's byline —
 * cannot quietly reintroduce a blank circle nobody can explain.
 *
 * `alt=""` because every current use sits beside the person's name in the same
 * link; announcing the picture as well would read the same thing twice.
 */
export function Avatar({
  src,
  size = 30,
  className,
}: {
  src: string | null | undefined;
  /** Rendered px. Also the intrinsic size, so the box never reflows. */
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || "/avatar-fallback.svg"}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={cn("rounded-pill object-cover ring-2 ring-green-100", className)}
      style={{ width: size, height: size }}
    />
  );
}
