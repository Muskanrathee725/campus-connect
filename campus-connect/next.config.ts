import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,  // ignore TS errors during build
  },
  eslint: {
    ignoreDuringBuilds: true, // ignore eslint errors during build
  },
};

export default nextConfig;