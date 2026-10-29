"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Aviso de cookies + Google Tag Manager. O GTM (estatísticas) só é carregado depois de o visitante aceitar;
 * a escolha fica guardada 1 ano no cookie pdt_consent. O link "Cookies" no rodapé volta a abrir o aviso.
 */
const COOKIE = "pdt_consent";
export const OPEN_CONSENT_EVENT = "pdt:abrir-cookies";

function readChoice(): "sim" | "nao" | null {
  const m = document.cookie.match(/(?:^|; )pdt_consent=(sim|nao)/);
  return m ? (m[1] as "sim" | "nao") : null;
}

function loadGtm(id: string) {
  if (document.getElementById("gtm-script")) return;
  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.id = "gtm-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

export function CookieConsent({ gtmId }: { gtmId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const choice = readChoice();
    if (choice === "sim") loadGtm(gtmId);
    if (!choice) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, [gtmId]);

  const choose = (value: "sim" | "nao") => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${value}; Max-Age=${365 * 86_400}; Path=/; SameSite=Lax${secure}`;
    setOpen(false);
    if (value === "sim") loadGtm(gtmId);
    // Retirar o consentimento só deixa de valer de todo depois de recarregar (o GTM já carregado fica na página).
    else if (document.getElementById("gtm-script")) location.reload();
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-live="polite" aria-label="Cookies" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-sm shadow-lg sm:flex-row sm:items-center">
      <p className="flex-1">
        Usamos cookies essenciais para o site funcionar e, se autorizar, cookies de estatística (Google) para perceber como o site é usado.{" "}
        <Link href="/politica-de-privacidade/" className="text-accent">Saber mais</Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => choose("nao")}>Só essenciais</button>
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => choose("sim")}>Aceitar</button>
      </div>
    </div>
  );
}

/** Link do rodapé que volta a abrir o aviso. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      Cookies
    </button>
  );
}
