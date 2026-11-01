"use client";

import { useState } from "react";
import type { PostFaq } from "@/db/schema";

/** Perguntas frequentes de um artigo: linhas pergunta/resposta, enviadas como JSON num campo escondido. */
export function FaqEditor({ name, defaultValue }: { name: string; defaultValue: PostFaq[] }) {
  const [rows, setRows] = useState<PostFaq[]>(defaultValue.length ? defaultValue : []);
  const set = (i: number, field: keyof PostFaq, value: string) => setRows(rows.map((r, k) => (k === i ? { ...r, [field]: value } : r)));
  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={JSON.stringify(rows.filter((r) => r.question.trim() || r.answer.trim()))} />
      {rows.length === 0 && <p className="text-sm text-muted">Sem perguntas. Aparecem no fim do artigo e o Google pode mostrá-las nos resultados.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <label className="field">Pergunta {i + 1}<input value={r.question} onChange={(e) => set(i, "question", e.target.value)} className="input" maxLength={300} /></label>
          <label className="field">Resposta<textarea value={r.answer} onChange={(e) => set(i, "answer", e.target.value)} rows={3} className="input" maxLength={2000} /></label>
          <div className="flex gap-2 text-sm">
            <button type="button" className="btn-ghost px-2 py-1 text-sm" disabled={i === 0} onClick={() => setRows(rows.map((x, k) => (k === i - 1 ? rows[i] : k === i ? rows[i - 1] : x)))}>Subir</button>
            <button type="button" className="btn-ghost px-2 py-1 text-sm text-danger" onClick={() => setRows(rows.filter((_, k) => k !== i))}>Remover</button>
          </div>
        </div>
      ))}
      {rows.length < 15 && <div><button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setRows([...rows, { question: "", answer: "" }])}>Acrescentar pergunta</button></div>}
    </div>
  );
}
