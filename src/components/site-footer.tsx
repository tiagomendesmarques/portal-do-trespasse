import Link from "next/link";
import { CookieSettingsLink } from "./cookie-consent";
import { LogoMark } from "./logo";

const COLS = [
  { title: "Ajuda no trespasse", links: [["Como vender o seu negócio", "/como-vender-o-seu-negocio/"], ["O nosso programa de ajuda", "/o-nosso-programa-de-ajuda/"], ["Promove o teu anúncio", "/promove-o-teu-anuncio/"]] },
  { title: "Informação", links: [["Blog", "/blog/"], ["Termos e Condições", "/termos-e-condicoes/"], ["Política de Privacidade", "/politica-de-privacidade/"]] },
  { title: "Suporte", links: [["FAQ", "/faq/"], ["Como manter-me seguro", "/como-manter-me-seguro/"], ["Contactos", "/contact/"]] },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy text-[#eaf4f3]">
      <div className="wrap grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
          <span className="flex items-center gap-2.5 font-display text-lg font-extrabold"><LogoMark size={30} />Portal do Trespasse</span>
          <p className="max-w-[42ch] opacity-80">O portal onde encontra os melhores negócios de Portugal. Tome proveito das categorias e localizações existentes para encontrar o seu próximo trespasse.</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h2 className="mb-2.5 font-sans text-xs font-bold uppercase tracking-widest text-brand">{c.title}</h2>
            {c.links.map(([label, href]) => (
              <Link key={href} href={href} className="block py-0.5 text-[#eaf4f3]/85 no-underline hover:underline">{label}</Link>
            ))}
          </div>
        ))}
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-4 text-xs sm:col-span-2 lg:col-span-4">
          <span className="opacity-70">© Portal do Trespasse {new Date().getFullYear()}. Publicar anúncios é gratuito.</span>
          {process.env.GTM_ID && <CookieSettingsLink className="cursor-pointer underline opacity-70 hover:opacity-100" />}
        </p>
      </div>
    </footer>
  );
}
