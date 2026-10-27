"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, resendVerificationAction, type FormState } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/site";
import { Alert, Field, Submit } from "./form-bits";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  const [resend, resendAction] = useActionState<FormState, FormData>(resendVerificationAction, {});

  if (state.needsVerification) {
    return (
      <div className="panel flex flex-col gap-4">
        <h2 className="text-xl font-bold">Confirme o seu email</h2>
        <p>Ainda não confirmou o email <b>{state.needsVerification}</b>. Abra a ligação que lhe enviámos quando criou a conta.</p>
        {resend.message ? (
          <Alert tone="ok">{resend.message}</Alert>
        ) : (
          <form action={resendAction}>
            <input type="hidden" name="email" value={state.needsVerification} />
            <Submit>Enviar o email outra vez</Submit>
          </form>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="panel flex flex-col gap-4" noValidate>
      <h2 className="text-xl font-bold">Entrar</h2>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field form="login" name="identifier" label="Email ou nome de utilizador" required autoComplete="username" defaultValue={state.values?.identifier} error={state.errors?.identifier} />
      <Field form="login" name="password" label="Password" type="password" required autoComplete="current-password" error={state.errors?.password} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="remember" className="accent-accent" /> Lembrar-se de mim
      </label>
      <Submit>Entrar</Submit>
      <Link href={ROUTES.lostPassword} className="text-sm text-accent">Esqueceu-se da sua password?</Link>
    </form>
  );
}
