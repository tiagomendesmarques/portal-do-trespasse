import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav, type NavItem } from "@/components/admin/nav";
import { LogoMark } from "@/components/logo";
import { isAdmin, requireStaff } from "@/lib/admin/guard";
import { adminBadges } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Back-office", template: "%s | Back-office" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const badges = await adminBadges();
  const groups: { title: string; items: NavItem[] }[] = [
    { title: "Geral", items: [{ href: "/admin/", label: "Painel" }] },
    {
      title: "Anúncios",
      items: [
        { href: "/admin/anuncios/", label: "Anúncios", badge: badges.pending },
        { href: "/admin/denuncias/", label: "Denúncias", badge: badges.reports },
        { href: "/admin/mensagens/", label: "Mensagens" },
      ],
    },
    { title: "Pessoas", items: [{ href: "/admin/utilizadores/", label: "Utilizadores" }] },
    {
      title: "Conteúdos",
      items: [
        { href: "/admin/blog/", label: "Blog" },
        { href: "/admin/paginas/", label: "Páginas" },
        ...(isAdmin(user) ? [{ href: "/admin/categorias/", label: "Categorias" }, { href: "/admin/campos/", label: "Campos do anúncio" }] : []),
      ],
    },
    ...(isAdmin(user)
      ? [{
          title: "Sistema",
          items: [
            { href: "/admin/emails/", label: "Emails" },
            { href: "/admin/redirects/", label: "Redirects" },
            { href: "/admin/definicoes/", label: "Definições" },
            { href: "/admin/auditoria/", label: "Auditoria" },
          ],
        }]
      : []),
  ];
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex flex-col gap-6 bg-navy p-4 text-white md:sticky md:top-0 md:h-screen md:w-60 md:flex-none md:overflow-y-auto">
        <Link href="/admin/" className="flex items-center gap-2 font-display font-extrabold text-white no-underline"><LogoMark size={28} />Back-office</Link>
        <AdminNav groups={groups} />
        <div className="mt-auto flex flex-col gap-1 border-t border-white/15 pt-3 text-sm">
          <span className="text-white/60">{user.displayName} · {user.role === "admin" ? "administrador" : "editor"}</span>
          <Link href="/" className="text-white/80">Ver o site</Link>
          <Link href="/my-account/" className="text-white/80">Minha conta</Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-bg p-4 md:p-8">{children}</main>
    </div>
  );
}
