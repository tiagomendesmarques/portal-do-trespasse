import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

// Ícone e nome quando o site é adicionado ao ecrã principal do telemóvel (Android).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Trespasse",
    description: "Trespasses, venda de empresas e oportunidades de investimento em Portugal.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0c1e3a",
    icons: [
      { src: "/icon1.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon2.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
