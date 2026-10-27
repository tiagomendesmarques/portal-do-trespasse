import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contactos",
  description: "Fale com a equipa do Portal do Trespasse.",
  alternates: { canonical: "/contact/" },
};

export default function ContactPage() {
  return (
    <div className="wrap grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex max-w-xl flex-col gap-4">
        <nav className="flex gap-1.5 text-sm text-muted" aria-label="Caminho"><Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span><span>Contactos</span></nav>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Contactos</h1>
        <p className="text-muted">Envie-nos uma mensagem e respondemos por email. Para falar com um anunciante, use o botão &quot;Enviar mensagem&quot; no anúncio.</p>
        <ContactForm />
      </div>
      <aside className="panel flex flex-col gap-2 self-start">
        <h2 className="font-sans text-base font-bold">Antes de escrever</h2>
        <p className="text-sm text-muted">Muitas dúvidas já têm resposta nas perguntas frequentes.</p>
        <Link href="/faq/" className="btn-ghost">Perguntas frequentes</Link>
      </aside>
    </div>
  );
}
