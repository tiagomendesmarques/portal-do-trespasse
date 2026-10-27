import { SITE_NAME, SITE_URL } from "@/lib/site";

export type Vars = Record<string, string | number | null | undefined>;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Substitui {chave}; variáveis em falta ficam vazias. */
export function fill(text: string, vars: Vars): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] == null ? "" : String(vars[k])));
}

const BUTTON = /^\[([^\]]+)\]\((\S+)\)$/;

export function renderEmail(t: { subject: string; heading: string; body: string }, vars: Vars) {
  const subject = fill(t.subject, vars);
  const heading = fill(t.heading, vars);
  const blocks = t.body.trim().split(/\n\s*\n/);

  const htmlBlocks = blocks.map((block) => {
    const b = block.trim();
    const m = BUTTON.exec(b);
    if (m) {
      const href = esc(fill(m[2], vars));
      return `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#1b766f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:6px">${esc(fill(m[1], vars))}</a></p>`;
    }
    // Escapa os valores das variáveis (texto de utilizadores) antes de juntar.
    const html = b
      .split("\n")
      .map((line) => esc(fill(line, vars)))
      .join("<br>");
    return `<p style="margin:0 0 16px">${html}</p>`;
  });

  const html = `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f4f7f7;font-family:Helvetica,Arial,sans-serif;color:#0c1e3a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="background:#0c1e3a;padding:18px 28px"><a href="${SITE_URL}/" style="color:#89d3cd;font-weight:800;font-size:18px;text-decoration:none">${SITE_NAME}</a></td></tr>
<tr><td style="padding:28px 28px 12px;font-size:15px;line-height:1.55">
<h1 style="font-size:22px;margin:0 0 18px;color:#0c1e3a">${esc(heading)}</h1>
${htmlBlocks.join("\n")}
</td></tr>
<tr><td style="padding:16px 28px 26px;font-size:12px;color:#56676d;border-top:1px solid #d8e2e1">${SITE_NAME} · <a href="${SITE_URL}/" style="color:#56676d">${SITE_URL.replace(/^https?:\/\//, "")}</a><br>Recebeu este email por causa da sua conta ou de um anúncio no portal.</td></tr>
</table></td></tr></table></body></html>`;

  const text =
    `${heading}\n\n` +
    blocks
      .map((block) => {
        const m = BUTTON.exec(block.trim());
        return m ? `${fill(m[1], vars)}: ${fill(m[2], vars)}` : fill(block.trim(), vars);
      })
      .join("\n\n") +
    `\n\n— ${SITE_NAME}\n${SITE_URL}/`;

  return { subject, html, text };
}
