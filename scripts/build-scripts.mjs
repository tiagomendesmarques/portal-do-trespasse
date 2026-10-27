// Empacota migrate e seed para correrem na imagem de produção sem tsx nem node_modules completos.
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/migrate.ts", "scripts/seed.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outExtension: { ".js": ".mjs" },
  // PGlite só é usado em desenvolvimento; em produção há DATABASE_URL.
  external: ["@electric-sql/pglite", "pg-native"],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  alias: { "@": "./src" },
  logLevel: "warning",
});
console.log("dist/migrate.mjs e dist/seed.mjs prontos");
