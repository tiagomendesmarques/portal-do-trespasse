import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // Os URLs do WordPress terminam em "/" e mantêm-se iguais.
  trailingSlash: true,
};

export default nextConfig;
