/**
 * O formulário usa texto simples: linhas em branco separam parágrafos e linhas começadas
 * por "-" ou "•" formam listas. Guardamos HTML simples (o mesmo formato dos anúncios do WordPress).
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const BULLET = /^\s*[-•*]\s+/;

export function textToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length && lines.every((l) => BULLET.test(l))) return `<ul>${lines.map((l) => `<li>${esc(l.replace(BULLET, ""))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(esc).join("<br>")}</p>`;
    })
    .join("\n");
}

/** Inverso aproximado, para editar anúncios existentes (incluindo os vindos do WordPress). */
export function htmlToText(html: string): string {
  return html
    .replace(/\r\n/g, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(ul|ol)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/h\d>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Número de caracteres que conta para o limite (texto visível, sem HTML). */
export const descriptionLength = (text: string) => text.replace(/\r\n/g, "\n").trim().length;
