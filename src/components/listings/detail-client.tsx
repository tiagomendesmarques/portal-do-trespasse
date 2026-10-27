"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Submit } from "@/components/auth/form-bits";
import type { FormState } from "@/lib/auth/actions";
import { contactSellerAction, reportListingAction, revealPhoneAction } from "@/lib/listings/actions";

export function Gallery({ images, title, fallback }: { images: { src: string; srcSet: string; thumb: string; width: number | null; height: number | null }[]; title: string; fallback: React.ReactNode }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="aspect-video overflow-hidden rounded-xl">{fallback}</div>;
  const img = images[i];
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-navy">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} srcSet={img.srcSet} sizes="(max-width: 960px) 100vw, 760px" alt={`${title}, foto ${i + 1} de ${images.length}`} className="size-full object-contain" />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => setI((i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-ink" aria-label="Foto anterior">‹</button>
            <button type="button" onClick={() => setI((i + 1) % images.length)} className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-ink" aria-label="Foto seguinte">›</button>
          </>
        )}
        <span className="absolute bottom-2 right-2 rounded-full bg-navy/75 px-2.5 py-0.5 text-xs text-white tabular-nums">{i + 1} / {images.length}</span>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((im, k) => (
            <button key={im.thumb} type="button" onClick={() => setI(k)} aria-label={`Ver foto ${k + 1}`} aria-current={k === i}
              className={`h-14 w-20 flex-none overflow-hidden rounded-md border-2 ${k === i ? "border-accent" : "border-transparent opacity-80"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.thumb} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhoneReveal({ listingId, loggedIn, loginHref }: { listingId: number; loggedIn: boolean; loginHref: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!loggedIn)
    return <Link href={loginHref} className="btn-ghost w-full"><span className="tabular-nums">9XX XXX XXX</span><span className="text-xs font-normal text-muted">Entre para ver o número</span></Link>;
  if (phone) return <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-ghost w-full tabular-nums">{phone}</a>;
  return (
    <button type="button" className="btn-ghost w-full" disabled={pending}
      onClick={async () => { setPending(true); const r = await revealPhoneAction(listingId); setPhone(r.phone ?? "Sem telefone indicado"); setPending(false); }}>
      <span className="tabular-nums">9XX XXX XXX</span><span className="text-xs font-normal text-muted">Mostrar número</span>
    </button>
  );
}

export function ContactSeller({ listingId, loggedIn, loginHref, defaults }: { listingId: number; loggedIn: boolean; loginHref: string; defaults: { name: string; email: string; phone: string } }) {
  const [state, action] = useActionState<FormState, FormData>(contactSellerAction, {});
  if (!loggedIn) return <Link href={loginHref} className="btn-primary w-full">Entrar para enviar mensagem</Link>;
  if (state.ok) return <Alert tone="ok">{state.message}</Alert>;
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <details className="group" open={Boolean(state.errors || state.message)}>
      <summary className="btn-primary w-full list-none">Enviar mensagem</summary>
      <form action={action} className="mt-3 flex flex-col gap-3" noValidate>
        {state.message && <Alert tone="error">{state.message}</Alert>}
        <input type="hidden" name="listingId" value={listingId} />
        <SmallField name="name" label="Nome" defaultValue={v.name ?? defaults.name} error={e.name} />
        <SmallField name="email" label="Email" type="email" defaultValue={v.email ?? defaults.email} error={e.email} />
        <SmallField name="phone" label="Telefone (opcional)" type="tel" defaultValue={v.phone ?? defaults.phone} error={e.phone} />
        <label className="field" htmlFor="contact-message">
          Mensagem
          <textarea id="contact-message" name="message" rows={5} className="input" defaultValue={v.message ?? "Olá, tenho interesse no seu anúncio. Podemos falar?"} aria-invalid={e.message ? true : undefined} />
          {e.message && <span className="err">{e.message}</span>}
        </label>
        <Submit>Enviar</Submit>
      </form>
    </details>
  );
}

function SmallField({ name, label, type = "text", defaultValue, error }: { name: string; label: string; type?: string; defaultValue?: string; error?: string }) {
  return (
    <label className="field" htmlFor={`contact-${name}`}>
      {label}
      <input id={`contact-${name}`} name={name} type={type} className="input" defaultValue={defaultValue} aria-invalid={error ? true : undefined} />
      {error && <span className="err">{error}</span>}
    </label>
  );
}

export function ReportListing({ listingId }: { listingId: number }) {
  const [state, action] = useActionState<FormState, FormData>(reportListingAction, {});
  if (state.ok) return <Alert tone="ok">{state.message}</Alert>;
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted underline">Denunciar abuso</summary>
      <form action={action} className="mt-2 flex flex-col gap-2" noValidate>
        {state.message && <Alert tone="error">{state.message}</Alert>}
        <input type="hidden" name="listingId" value={listingId} />
        <label className="field" htmlFor="report-reason">
          O que está errado neste anúncio?
          <textarea id="report-reason" name="reason" rows={3} className="input" aria-invalid={state.errors?.reason ? true : undefined} />
          {state.errors?.reason && <span className="err">{state.errors.reason}</span>}
        </label>
        <Submit>Enviar denúncia</Submit>
      </form>
    </details>
  );
}

export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${u}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["WhatsApp", `https://wa.me/?text=${t}%20${u}`],
    ["X", `https://x.com/intent/post?url=${u}&text=${t}`],
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map(([name, href]) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" className="btn-ghost px-2.5 py-1.5 text-xs">{name}</a>)}
      <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true), () => {})}>
        {copied ? "Ligação copiada" : "Copiar ligação"}
      </button>
    </div>
  );
}
