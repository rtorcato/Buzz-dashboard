import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone for a small Docker image.
  output: "standalone",
};

export default nextConfig;
