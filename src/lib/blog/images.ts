import { randomUUID } from "node:crypto";
import { mediaSrcSet, mediaUrl, storeImage } from "@/lib/media";
import { SITE_ENV } from "@/lib/site";

/**
 * Imagens dos artigos vindas de bancos de imagens grátis.
 * - Pexels: o site descarrega e guarda uma cópia em WebP (3 tamanhos), como as fotos dos anúncios.
 * - Unsplash: fica nos servidores do Unsplash (as regras da API deles obrigam a isso) com crédito ao fotógrafo.
 * Qualquer outro sítio é recusado.
 */
const HOSTS: Record<string, "copy" | "link"> = {
  "images.pexels.com": "copy",
  "images.unsplash.com": "link",
  "plus.unsplash.com": "link",
};
const MAX_BYTES = 15 * 1024 * 1024;

export class ImageError extends Error {}

/** Os testes usam um banco de imagens falso; em produção só os anfitriões reais. */
function testOrigin(): string | null {
  return SITE_ENV !== "production" ? (process.env.BLOG_IMAGE_TEST_ORIGIN ?? null) : null;
}

export function imageSource(raw: string): { url: URL; mode: "copy" | "link" } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImageError(`Endereço de imagem inválido: ${raw}`);
  }
  const test = testOrigin();
  if (test && url.origin === test) return { url, mode: "copy" };
  const mode = HOSTS[url.hostname];
  if (url.protocol !== "https:" || !mode) throw new ImageError(`Só são aceites imagens do Pexels (images.pexels.com) ou do Unsplash (images.unsplash.com): ${raw}`);
  return { url, mode };
}

/** Endereço do Unsplash com a largura pedida (o Unsplash redimensiona; ver "Dynamically resizable images"). */
export function unsplashSized(raw: string, width: number): string {
  const url = new URL(raw);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", "80");
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "max");
  return url.toString();
}
export const unsplashSrcSet = (raw: string) => [400, 800, 1600].map((w) => `${unsplashSized(raw, w)} ${w}w`).join(", ");

/** Descarrega uma imagem permitida e guarda-a (Pexels), ou confirma que existe (Unsplash). */
export async function importImage(raw: string): Promise<{ key: string; width: number; height: number } | { url: string }> {
  const { url, mode } = imageSource(raw);
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) }).catch((e) => {
    throw new ImageError(`Não foi possível obter a imagem ${raw}: ${e instanceof Error ? e.message : e}`);
  });
  if (res.status !== 200) throw new ImageError(`A imagem ${raw} respondeu ${res.status}.`);
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) throw new ImageError(`O endereço ${raw} não é uma imagem.`);
  if (mode === "link") {
    await res.body?.cancel();
    return { url: url.toString() };
  }
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new ImageError(`A imagem ${raw} tem mais de 15 MB.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new ImageError(`A imagem ${raw} tem mais de 15 MB.`);
  const key = `blog/api/${randomUUID()}`;
  try {
    return { key, ...(await storeImage(key, buf)) };
  } catch {
    throw new ImageError(`Não foi possível ler a imagem ${raw}.`);
  }
}

/**
 * Trata as <img> do texto: as do Pexels passam a ser servidas pelo site, as do Unsplash ficam com
 * tamanhos responsivos. Todas ficam com loading="lazy" e srcset.
 */
export async function processInlineImages(html: string): Promise<string> {
  const tags = [...new Set(html.match(/<img\b[^>]*>/gi) ?? [])];
  for (const tag of tags) {
    const src = tag.match(/\bsrc\s*=\s*"([^"]+)"/i)?.[1];
    const alt = tag.match(/\balt\s*=\s*"([^"]*)"/i)?.[1] ?? "";
    if (!src || src.startsWith("/media/")) continue;
    const img = await importImage(src.replace(/&amp;/g, "&"));
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const replacement = "key" in img
      ? `<img src="${mediaUrl(img.key, 1600)}" srcset="${mediaSrcSet(img.key)}" sizes="(min-width: 1024px) 760px, 100vw" alt="${alt}" width="${img.width}" height="${img.height}" loading="lazy">`
      : `<img src="${esc(unsplashSized(img.url, 1600))}" srcset="${esc(unsplashSrcSet(img.url))}" sizes="(min-width: 1024px) 760px, 100vw" alt="${alt}" loading="lazy">`;
    html = html.split(tag).join(replacement);
  }
  return html;
}

/** Endereço da imagem de destaque de um artigo, seja guardada no site ou do Unsplash. */
export function postImage(post: { featuredImageKey: string | null; featuredImageUrl: string | null }, width: 400 | 800 | 1600) {
  if (post.featuredImageUrl) return { src: unsplashSized(post.featuredImageUrl, width), srcSet: unsplashSrcSet(post.featuredImageUrl) };
  if (post.featuredImageKey) return { src: mediaUrl(post.featuredImageKey, width), srcSet: mediaSrcSet(post.featuredImageKey) };
  return null;
}
