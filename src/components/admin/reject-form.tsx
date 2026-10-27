"use client";

import { useActionState } from "react";
import { Alert, Submit } from "@/components/auth/form-bits";
import { REJECT_REASONS } from "@/lib/admin/constants";
import { rejectListingAction } from "@/lib/admin/listing-actions";
import type { FormState } from "@/lib/auth/actions";

export function RejectForm({ id }: { id: number }) {
  const [s, action] = useActionState<FormState, FormData>(rejectListingAction, {});
  if (s.ok) return <Alert tone="ok">{s.message}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="id" value={id} />
      <label className="field" htmlFor="rej-preset">
        Motivo
        <select id="rej-preset" name="preset" className="input" defaultValue="">
          <option value="">Escrever o motivo abaixo</option>
          {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label className="field" htmlFor="rej-reason">
        Explicação para o anunciante (opcional se escolheu um motivo)
        <textarea id="rej-reason" name="reason" rows={3} className="input" aria-invalid={s.errors?.reason ? true : undefined} />
        {s.errors?.reason && <span className="err">{s.errors.reason}</span>}
      </label>
      <Submit>Rejeitar e avisar o anunciante</Submit>
    </form>
  );
}
