import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * Next defaults to 1 MB, which a photograph off any modern phone exceeds
       * before it leaves the camera roll. The largest single file a Server
       * Action here has to clear is a selfie upload: `MAX_SELFIE_BYTES` in
       * lib/images.ts is 5 MB, and the rest is room for the multipart
       * envelope and the other form fields around it.
       */
      bodySizeLimit: "7mb",
    },
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
