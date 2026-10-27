"use client";

import { useState } from "react";

/** Imagem de destaque de um artigo: carrega para /api/upload?tipo=blog e guarda a chave num campo escondido. */
export function ImagePicker({ name, defaultKey }: { name: string; defaultKey: string | null }) {
  const [key, setKey] = useState(defaultKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    const body = new FormData(); body.append("file", file);
    const res = await fetch("/api/upload?tipo=blog", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setKey(json.key); else setError(json.error ?? "Não foi possível carregar.");
    setBusy(false);
  }
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={key} />
      {key && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/media/${key}-800.webp`} alt="Imagem de destaque" className="aspect-video w-full max-w-md rounded-lg object-cover" />
      )}
      <div className="flex flex-wrap gap-2">
        <label className="btn-ghost cursor-pointer text-sm">{busy ? "A carregar…" : key ? "Trocar imagem" : "Carregar imagem"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {key && <button type="button" className="btn-ghost text-sm" onClick={() => setKey("")}>Retirar</button>}
      </div>
      {error && <span className="err">{error}</span>}
    </div>
  );
}
