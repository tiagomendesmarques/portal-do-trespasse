"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestResetAction, resetPasswordAction, type FormState } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/site";
import { Alert, Field, Submit } from "./form-bits";

export function LostPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestResetAction, {});
  if (state.ok) return <Alert tone="ok">{state.message}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field form="lost" name="identifier" label="Email ou nome de utilizador" required autoComplete="username" error={state.errors?.identifier} />
      <Submit>Enviar ligação</Submit>
      <Link href={ROUTES.account} className="text-sm text-accent">Voltar a entrar</Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && (
        <Alert tone="error">
          {state.message} <Link href={ROUTES.lostPassword} className="underline">Pedir nova ligação</Link>
        </Alert>
      )}
      <input type="hidden" name="token" value={token} />
      <Field form="reset" name="password" label="Nova password" type="password" required hint="Mínimo 8 caracteres." autoComplete="new-password" error={state.errors?.password} />
      <Field form="reset" name="password2" label="Confirme a nova password" type="password" required autoComplete="new-password" error={state.errors?.password2} />
      <Submit>Guardar nova password</Submit>
    </form>
  );
}
