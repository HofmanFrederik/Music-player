import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/music-player",
  // See fix commit for why this is here — matches the main site's own
  // trailingSlash convention so page routes proxy through cleanly. The
  // /api/recognise redirect-loop this doesn't fix is a separate,
  // still-open issue being diagnosed locally before another live push.
  trailingSlash: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
