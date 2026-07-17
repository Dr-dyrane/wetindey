import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // The action still enforces a strict 2 MiB file limit. Multipart FormData
      // adds transport overhead, so the Server Action envelope needs headroom.
      bodySizeLimit: "3mb",
    },
  },
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
      // User avatars live in Vercel Blob (see uploadMyAvatar in actions.ts). Public
      // blobs are served from a per-store subdomain of public.blob.vercel-storage.com,
      // so the store id is wildcarded; without this next/image rejects the host and
      // every avatar renders broken.
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
