"use client";

import { useState } from "react";

/** Editor de HTML simples com pré-visualização isolada (iframe sem scripts). */
export function HtmlEditor({ name, defaultValue, rows = 18 }: { name: string; defaultValue: string; rows?: number }) {
  const [html, setHtml] = useState(defaultValue);
  const [preview, setPreview] = useState(false);
  const wrap = (tag: string) => (ev: React.MouseEvent<HTMLButtonElement>) => {
    const ta = (ev.currentTarget.closest("[data-editor]") as HTMLElement).querySelector("textarea")!;
    const { selectionStart: a, selectionEnd: b } = ta;
    const sel = html.slice(a, b) || "texto";
    const piece = tag === "a" ? `<a href="https://">${sel}</a>` : tag === "li" ? `<ul>\n  <li>${sel}</li>\n</ul>` : `<${tag}>${sel}</${tag}>`;
    setHtml(html.slice(0, a) + piece + html.slice(b));
  };
  const doc = `<!doctype html><meta charset="utf-8"><style>body{font:16px/1.65 Helvetica,Arial,sans-serif;color:#0c1e3a;max-width:70ch;margin:16px}h2{font-size:1.4rem}a{color:#1b766f}img{max-width:100%}</style>${html}`;
  return (
    <div className="flex flex-col gap-2" data-editor>
      <div className="flex flex-wrap items-center gap-1.5">
        {[["h2", "Título"], ["h3", "Subtítulo"], ["p", "Parágrafo"], ["strong", "Negrito"], ["em", "Itálico"], ["li", "Lista"], ["a", "Ligação"]].map(([t, l]) => (
          <button key={t} type="button" onClick={wrap(t)} disabled={preview} className="btn-ghost px-2.5 py-1 text-xs">{l}</button>
        ))}
        <button type="button" onClick={() => setPreview(!preview)} className="btn-ghost ml-auto px-2.5 py-1 text-xs">{preview ? "Editar HTML" : "Pré-visualizar"}</button>
      </div>
      <textarea name={name} value={html} onChange={(e) => setHtml(e.target.value)} rows={rows} hidden={preview} className="input font-mono text-sm" spellCheck />
      {preview && <iframe title="Pré-visualização" sandbox="" srcDoc={doc} className="h-[480px] w-full rounded-md border border-line bg-white" />}
    </div>
  );
}
