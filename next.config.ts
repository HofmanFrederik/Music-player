import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/music-player",
  // The main frederikhofman.be site proxies /music-player here via a
  // rewrite and normalizes to a trailing slash itself (its own
  // trailingSlash: true) — without matching that here, this app's default
  // "redirect away from a trailing slash" bounced against the main site's
  // "redirect toward one", looping forever. Matching it breaks the loop.
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
