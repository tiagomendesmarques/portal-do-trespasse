"use client";

import { useActionState } from "react";
import { Alert } from "@/components/auth/form-bits";
import type { FormState } from "@/lib/auth/actions";

type Props = {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit?: string;
  /** Botões extra (ex.: "Enviar teste"), cada um com name="op". */
  extraButtons?: { op: string; label: string; tone?: "ghost" | "danger" }[];
  labels?: Record<string, string>;
  className?: string;
};

/** Formulário genérico do back-office: mostra sucesso ou a lista de erros no topo. */
export function AdminForm({ action, children, submit = "Guardar", extraButtons = [], labels = {}, className = "" }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const errors = Object.entries(state.errors ?? {});
  return (
    <form action={formAction} className={`flex flex-col gap-4 ${className}`} noValidate>
      {state.ok && <Alert tone="ok">{state.message}</Alert>}
      {!state.ok && state.message && <Alert tone="error">{state.message}</Alert>}
      {errors.length > 0 && (
        <Alert tone="error">
          <ul className="list-disc pl-4">{errors.map(([k, v]) => <li key={k}>{labels[k] ? <b>{labels[k]}: </b> : null}{v}</li>)}</ul>
        </Alert>
      )}
      {children}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending} name="op" value="save">{pending ? "A guardar…" : submit}</button>
        {extraButtons.map((b) => (
          <button key={b.op} name="op" value={b.op} disabled={pending} className={b.tone === "danger" ? "btn bg-danger text-white" : "btn-ghost"}>{b.label}</button>
        ))}
      </div>
    </form>
  );
}

export function Check({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 accent-accent" />
      <span>{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}
