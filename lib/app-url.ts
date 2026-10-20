import "server-only";

/**
 * The site's public origin, without a trailing slash — what QR codes, share
 * links and Open Graph images are built on.
 *
 * Read at request time, never baked into the build. Next replaces every
 * `process.env.NEXT_PUBLIC_*` it can see during `next build` with the value it
 * had *then*, in server code as well as client code. That was harmless while
 * the site was built on the machine it ran on; it is wrong for a Docker image,
 * which is built once and then run behind whatever address the person
 * installing it has. A QR code printed from such an image would point at the
 * build machine.
 *
 * So `APP_URL` comes first: an ordinary variable Next leaves alone, set when
 * the container starts. `NEXT_PUBLIC_APP_URL` is still honoured after it, for
 * the existing `.env` files that only set that one.
 */
export function appUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
