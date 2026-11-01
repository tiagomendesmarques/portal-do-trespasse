import { guard } from "@/lib/blog/api-route";
import { USEFUL_LINKS, siteLinks, usedKeywords } from "@/lib/blog/links";
import { SEO_LIMITS } from "@/lib/blog/seo";

export const dynamic = "force-dynamic";

/**
 * O que quem escreve precisa de saber antes de escrever: artigos e palavras-chave que já existem
 * (para não repetir) e os endereços do site que pode usar como ligações internas.
 */
export async function GET(req: Request) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const [links, keywords] = await Promise.all([siteLinks(), usedKeywords()]);
  return Response.json({
    usedKeywords: keywords,
    posts: links.posts.filter((p) => p.status === "published").map((p) => ({ title: p.title, url: `/${p.slug}/`, focusKeyword: p.focusKeyword })),
    categories: links.categories,
    distritos: links.distritos,
    pages: links.pages,
    usefulLinks: USEFUL_LINKS,
    imageHosts: { "images.pexels.com": "copiada para o site", "images.unsplash.com": "fica no Unsplash (creditar o fotógrafo)" },
    limits: SEO_LIMITS,
  });
}
