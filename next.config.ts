import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/garden-index", destination: "/index", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/index", destination: "/garden-index" }];
  },
};

export default nextConfig;
