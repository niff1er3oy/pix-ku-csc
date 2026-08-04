import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // `forbidden()` and `unauthorized()` in lib/dal.ts do nothing catchable
    // without this. Measured before enabling it: a signed-in non-admin
    // requesting /admin got HTTP 200 and a loading state that never resolved —
    // no data leaked, but nothing ever told them why, and nothing ever will
    // until a boundary exists to catch the interrupt. See app/forbidden.tsx.
    authInterrupts: true,
    // Lets an event card's cover image morph into the event header instead of
    // the page hard-cutting. See the ::view-transition rules in globals.css.
    viewTransition: true,
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
