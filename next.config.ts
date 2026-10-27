import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite"],
  // Os URLs do WordPress terminam em "/" e mantêm-se iguais.
  trailingSlash: true,
  // O código lê ficheiros por caminhos dinâmicos (imagens, PGlite) e o tracing copiaria a pasta toda.
  outputFileTracingExcludes: {
    // Só nomes que não existem dentro de node_modules: os padrões aplicam-se a qualquer nível.
    "*": [".data/**", "prototipo/**", "e2e/**", "*.md"],
  },
};

export default nextConfig;
