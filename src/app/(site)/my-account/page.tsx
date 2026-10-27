import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Alert } from "@/components/auth/form-bits";
import { AccountShell } from "@/components/account/shell";
import { accountCounts, myListings } from "@/lib/account/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/site";

export const metadata: Metadata = { title: "Minha conta", robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string; verified?: string; verify?: string; password?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="wrap py-10">
        <div className="mx-auto mb-6 flex max-w-[920px] flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-extrabold">Entrar ou criar conta</h1>
          <p className="text-muted">Precisa de uma conta para publicar e gerir anúncios. É gratuito.</p>
        </div>
        {sp.verify === "invalid" && (
          <div className="mx-auto mb-4 max-w-[920px]">
            <Alert tone="error">A ligação de confirmação expirou ou já foi usada. Entre para pedir uma nova.</Alert>
          </div>
        )}
        {sp.next && (
          <div className="mx-auto mb-4 max-w-[920px]">
            <Alert>Desculpe, precisa de fazer login primeiro.</Alert>
          </div>
        )}
        <div className="mx-auto grid max-w-[920px] gap-5 md:grid-cols-2">
          <LoginForm next={sp.next} />
          <RegisterForm />
        </div>
      </div>
    );
  }

  const [counts, listings] = await Promise.all([accountCounts(user.id), myListings(user.id)]);
  const by = (s: string) => listings.filter((l) => l.status === s).length;
  const views = listings.reduce((a, l) => a + l.views, 0);
  const soon = listings.filter((l) => l.status === "published" && l.expiresAt && l.expiresAt.getTime() - Date.now() < 15 * 86_400_000);
  const rejected = listings.filter((l) => l.status === "rejected");
  return (
    <AccountShell user={user} active="painel" title={`Olá, ${user.displayName}`} counts={counts}>
      {sp.verified && <Alert tone="ok">Email confirmado. Já pode publicar anúncios.</Alert>}
      {sp.password && <Alert tone="ok">Password alterada.</Alert>}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Publicados", by("published")], ["À espera de aprovação", by("pending")], ["Visualizações", views], ["Mensagens recebidas", counts.mensagens]].map(([label, n]) => (
          <div key={label} className="panel p-4"><dt className="eyebrow">{label}</dt><dd className="font-display text-3xl font-extrabold tabular-nums">{n}</dd></div>
        ))}
      </dl>
      {rejected.length > 0 && <Alert tone="error">{rejected.length === 1 ? "Um anúncio precisa" : `${rejected.length} anúncios precisam`} de alterações para ser publicado. <Link href="/my-account/listings/" className="underline">Ver motivo</Link></Alert>}
      {soon.length > 0 && <Alert>{soon.length === 1 ? "Um anúncio expira" : `${soon.length} anúncios expiram`} nos próximos 15 dias. <Link href="/my-account/listings/" className="underline">Renovar</Link></Alert>}
      <div className="panel flex flex-col gap-3">
        {listings.length ? (
          <>
            <h2 className="text-xl font-bold">Os seus anúncios</h2>
            <p className="text-muted">Mantenha as fotografias, a renda e a faturação atualizadas: anúncios completos recebem mais contactos.</p>
            <div className="flex flex-wrap gap-2"><Link href="/my-account/listings/" className="btn-ghost">Gerir anúncios</Link><Link href={ROUTES.post} className="btn-primary">Publicar outro</Link></div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Ainda não publicou nenhum anúncio</h2>
            <p className="text-muted">Demora cerca de 5 minutos e é gratuito.</p>
            <Link href={ROUTES.post} className="btn-primary self-start">Publicar o primeiro anúncio</Link>
          </>
        )}
      </div>
    </AccountShell>
  );
}
