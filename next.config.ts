import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Lets an event card's cover image morph into the event header instead of
    // the page hard-cutting. See the ::view-transition rules in globals.css.
    viewTransition: true,
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
