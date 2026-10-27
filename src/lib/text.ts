/** Minúsculas e sem acentos: "Café" → "cafe". Usado na pesquisa. */
export function normalizeText(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function excerpt(html: string, max = 180): string {
  const t = stripHtml(html).replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max)).replace(/[,.;:]$/, "") + "…";
}

export function buildSearchText(parts: (string | null | undefined)[]): string {
  return normalizeText(parts.filter(Boolean).map((p) => stripHtml(p!)).join(" "));
}
