import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Item photography is hosted on Wikimedia Commons (see src/db/itemImages.ts).
    // next/image rejects any remote host not listed here, so an empty list meant
    // every product photo would fail rather than render.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
};

export default nextConfig;
