import type { MetadataRoute } from "next";
import { isProduction, SITE_URL } from "@/lib/site";

// Gerado a cada pedido: o SITE_ENV só existe no Cloud Run, não durante o build da imagem.
// (Estático, o robots.txt da produção ficava com "Disallow: /" e o Google deixava de indexar.)
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/my-account/", "/post-an-ad/", "/admin/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
