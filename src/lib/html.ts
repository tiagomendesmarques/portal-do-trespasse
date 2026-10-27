import sanitizeHtml from "sanitize-html";

/** HTML de anúncios (escrito por utilizadores): só formatação básica, sem imagens nem estilos. */
export function sanitizeListingHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote"],
    allowedAttributes: {},
  });
}

/** HTML de artigos e páginas (escrito pela equipa): permite links, imagens e tabelas. */
export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption", "h1", "h2"]),
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      "*": ["id"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tag, attribs) => {
        const external = /^https?:\/\//.test(attribs.href ?? "") && !/portaldotrespasse\.pt/.test(attribs.href ?? "");
        return { tagName: "a", attribs: external ? { ...attribs, rel: "noopener nofollow", target: "_blank" } : attribs };
      },
      img: (tag, attribs) => ({ tagName: "img", attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}
