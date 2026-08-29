import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/music-player",
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
