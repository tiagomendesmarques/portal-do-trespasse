import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { peekUserToken } from "@/lib/auth/tokens";
import { ROUTES } from "@/lib/site";

export const metadata: Metadata = { title: "Nova password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await peekUserToken(token, "reset_password");
  return (
    <div className="wrap py-10">
      <div className="panel mx-auto flex max-w-[460px] flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Definir nova password</h1>
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <p>A ligação expirou ou já foi usada. As ligações são válidas durante 1 hora.</p>
            <Link href={ROUTES.lostPassword} className="btn-primary self-start">Pedir nova ligação</Link>
          </>
        )}
      </div>
    </div>
  );
}
