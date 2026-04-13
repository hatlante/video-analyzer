import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ffmpeg-static'],
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
