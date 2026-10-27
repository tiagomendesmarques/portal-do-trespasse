import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Alert } from "@/components/auth/form-bits";
import { logoutAction } from "@/lib/auth/actions";
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

  return (
    <div className="wrap py-10">
      <p className="eyebrow">Minha conta</p>
      <h1 className="mb-5 text-3xl font-extrabold">Olá, {user.displayName}</h1>
      <div className="flex max-w-2xl flex-col gap-4">
        {sp.verified && <Alert tone="ok">Email confirmado. Já pode publicar anúncios.</Alert>}
        {sp.password && <Alert tone="ok">Password alterada.</Alert>}
        <div className="panel flex flex-col gap-3">
          <p>O painel da conta (os meus anúncios, favoritos, editar conta) chega na fase 3.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={ROUTES.post} className="btn-primary">Publicar anúncio</Link>
            <form action={logoutAction}>
              <button className="btn-ghost" type="submit">Terminar sessão</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
