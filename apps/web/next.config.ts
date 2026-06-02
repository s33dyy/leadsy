import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@leadsy/ai",
    "@leadsy/domain",
    "@leadsy/events",
    "@leadsy/observability",
    "@leadsy/security",
    "@leadsy/workflows"
  ],
};

export default nextConfig;
