import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed Middleware to Proxy. This is an *optimistic* gate only: it
 * redirects signed-out visitors away from private areas so they don't load a
 * shell that will fail anyway. The real checks live in lib/dal.ts, next to the
 * data — this file never queries the database, because it runs on every route
 * including prefetches.
 */

const PRIVATE_PREFIXES = ["/studio", "/admin", "/me", "/profile"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Presence of the session cookie only. Whether it is valid, unexpired, and
  // attached to a user with the right role is settled by the DAL.
  const hasSession =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token");

  if (hasSession) return NextResponse.next();

  const signInUrl = new URL("/signin", request.url);
  signInUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
