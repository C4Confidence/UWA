import { fileURLToPath } from "node:url";

const apiOrigin = process.env.API_ORIGIN || "http://127.0.0.1:4000";
const imageHosts = (
  process.env.IMAGE_HOSTS || "res.cloudinary.com,images.unsplash.com"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  env: { NEXT_PUBLIC_OPTIMIZED_IMAGE_HOSTS: imageHosts.join(",") },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/uploads/:path*", destination: `${apiOrigin}/uploads/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
