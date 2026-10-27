"use client";

import { useActionState } from "react";
import { Alert, Submit } from "@/components/auth/form-bits";
import type { FormState } from "@/lib/auth/actions";
import { siteContactAction } from "@/lib/content/actions";

export function ContactForm() {
  const [state, action] = useActionState<FormState, FormData>(siteContactAction, {});
  if (state.ok) return <Alert tone="ok">{state.message}</Alert>;
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const field = (name: string, label: string, type = "text") => (
    <label className="field" htmlFor={`ct-${name}`}>
      {label}
      <input id={`ct-${name}`} name={name} type={type} className="input" defaultValue={v[name]} aria-invalid={e[name] ? true : undefined} />
      {e[name] && <span className="err">{e[name]}</span>}
    </label>
  );
  return (
    <form action={action} className="panel flex flex-col gap-4" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      {field("name", "Nome")}
      {field("email", "Email", "email")}
      <label className="field" htmlFor="ct-message">
        Mensagem
        <textarea id="ct-message" name="message" rows={6} className="input" defaultValue={v.message} aria-invalid={e.message ? true : undefined} />
        {e.message && <span className="err">{e.message}</span>}
      </label>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <Submit>Enviar mensagem</Submit>
    </form>
  );
}
