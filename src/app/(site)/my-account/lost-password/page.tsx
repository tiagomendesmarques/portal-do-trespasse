import type { Metadata } from "next";
import { LostPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Recuperar password", robots: { index: false } };

export default function LostPasswordPage() {
  return (
    <div className="wrap py-10">
      <div className="panel mx-auto flex max-w-[460px] flex-col gap-4">
        <h1 className="text-2xl font-extrabold">Recuperar password</h1>
        <p className="text-muted">Indique o seu email ou nome de utilizador. Enviamos uma ligação para criar uma nova password.</p>
        <LostPasswordForm />
      </div>
    </div>
  );
}
