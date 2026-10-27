"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/site";
import { Alert, Field, Submit } from "./form-bits";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, {});

  if (state.ok) {
    return (
      <div className="panel flex flex-col gap-3">
        <h2 className="text-xl font-bold">Confirme o seu email</h2>
        <Alert tone="ok">{state.message}</Alert>
        <p className="text-sm text-muted">Não recebeu? Veja a pasta de spam. A ligação é válida durante 48 horas.</p>
      </div>
    );
  }

  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="panel flex flex-col gap-4" noValidate>
      <h2 className="text-xl font-bold">Criar conta</h2>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field form="reg" name="phone" label="Número de telefone" type="tel" autoComplete="tel" defaultValue={v.phone} error={e.phone} />
      <Field form="reg" name="username" label="Nome de utilizador" required hint="Aparece nos seus anúncios e não pode ser alterado." autoComplete="username" defaultValue={v.username} error={e.username} />
      <Field form="reg" name="email" label="Endereço de email" type="email" required autoComplete="email" defaultValue={v.email} error={e.email} />
      <Field form="reg" name="password" label="Password" type="password" required hint="Mínimo 8 caracteres." autoComplete="new-password" error={e.password} />
      <Field form="reg" name="password2" label="Confirme a password" type="password" required autoComplete="new-password" error={e.password2} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="privacy" required className="mt-1 accent-accent" aria-invalid={e.privacy ? true : undefined} />
        <span>
          Os seus dados pessoais serão usados para gerir a sua conta e os seus anúncios, como descrito na nossa{" "}
          <Link href={ROUTES.privacy} className="text-accent">política de privacidade</Link>. <span className="text-danger">*</span>
          {e.privacy && <span className="err block">{e.privacy}</span>}
        </span>
      </label>
      <Submit>Criar conta</Submit>
    </form>
  );
}
