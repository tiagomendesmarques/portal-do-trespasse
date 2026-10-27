"use client";

import { useActionState } from "react";
import { Alert, Submit } from "@/components/auth/form-bits";
import { changeEmailAction, changePasswordAction, deleteAccountAction, updateProfileAction } from "@/lib/account/actions";
import type { FormState } from "@/lib/auth/actions";

function Input({ form, name, label, type = "text", defaultValue, error, hint, autoComplete }: { form: string; name: string; label: string; type?: string; defaultValue?: string | null; error?: string; hint?: string; autoComplete?: string }) {
  const id = `${form}-${name}`;
  return (
    <label className="field" htmlFor={id}>
      {label}
      {hint && <span className="hint">{hint}</span>}
      <input id={id} name={name} type={type} defaultValue={defaultValue ?? ""} autoComplete={autoComplete} className="input" aria-invalid={error ? true : undefined} />
      {error && <span className="err">{error}</span>}
    </label>
  );
}

type Profile = { displayName: string; firstName: string | null; lastName: string | null; phone: string | null; whatsapp: string | null; website: string | null; locationId: number | null; username: string; email: string };

export function ProfileForm({ user, distritos }: { user: Profile; distritos: { id: number; name: string }[] }) {
  const [s, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  const e = s.errors ?? {};
  return (
    <form action={action} className="panel flex flex-col gap-4" noValidate>
      <h2 className="text-xl font-bold">Perfil</h2>
      {s.ok && <Alert tone="ok">{s.message}</Alert>}
      <p className="text-sm text-muted">Nome de utilizador: <b>{user.username}</b> (não pode ser alterado).</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Input form="perfil" name="displayName" label="Nome público *" hint="Aparece nos seus anúncios." defaultValue={user.displayName} error={e.displayName} />
        <label className="field" htmlFor="perfil-locationId">
          Distrito
          <select id="perfil-locationId" name="locationId" defaultValue={user.locationId ?? ""} className="input">
            <option value="">Prefiro não indicar</option>
            {distritos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <Input form="perfil" name="firstName" label="Primeiro nome" defaultValue={user.firstName} autoComplete="given-name" />
        <Input form="perfil" name="lastName" label="Apelido" defaultValue={user.lastName} autoComplete="family-name" />
        <Input form="perfil" name="phone" label="Telefone" type="tel" defaultValue={user.phone} error={e.phone} hint="Usado por omissão nos anúncios novos." autoComplete="tel" />
        <Input form="perfil" name="whatsapp" label="WhatsApp" type="tel" defaultValue={user.whatsapp} error={e.whatsapp} />
        <Input form="perfil" name="website" label="Website" type="url" defaultValue={user.website} error={e.website} />
      </div>
      <div><Submit>Guardar perfil</Submit></div>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [s, action] = useActionState<FormState, FormData>(changeEmailAction, {});
  const e = s.errors ?? {};
  return (
    <form action={action} className="panel flex flex-col gap-4" noValidate>
      <h2 className="text-xl font-bold">Email</h2>
      {s.ok && <Alert tone="ok">{s.message}</Alert>}
      <p className="text-sm text-muted">Email atual: <b>{email}</b>. Avisamos o endereço antigo quando muda.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Input form="email" name="email" label="Novo email" type="email" error={e.email} autoComplete="email" />
        <Input form="email" name="password" label="Password atual" type="password" error={e.password} autoComplete="current-password" />
      </div>
      <div><Submit>Alterar email</Submit></div>
    </form>
  );
}

export function PasswordForm() {
  const [s, action] = useActionState<FormState, FormData>(changePasswordAction, {});
  const e = s.errors ?? {};
  return (
    <form action={action} className="panel flex flex-col gap-4" noValidate>
      <h2 className="text-xl font-bold">Password</h2>
      {s.ok && <Alert tone="ok">{s.message}</Alert>}
      <div className="grid gap-4 md:grid-cols-3">
        <Input form="pw" name="currentPassword" label="Password atual" type="password" error={e.currentPassword} autoComplete="current-password" />
        <Input form="pw" name="newPassword" label="Nova password" type="password" hint="Mínimo 8 caracteres." error={e.newPassword} autoComplete="new-password" />
        <Input form="pw" name="newPassword2" label="Confirmar nova password" type="password" error={e.newPassword2} autoComplete="new-password" />
      </div>
      <div><Submit>Alterar password</Submit></div>
    </form>
  );
}

export function DeleteAccountForm({ listings }: { listings: number }) {
  const [s, action] = useActionState<FormState, FormData>(deleteAccountAction, {});
  const e = s.errors ?? {};
  return (
    <details className="panel border-danger/40">
      <summary className="cursor-pointer text-lg font-bold text-danger">Apagar conta</summary>
      <form action={action} className="mt-4 flex flex-col gap-4" noValidate>
        {s.message && <Alert tone="error">{s.message}</Alert>}
        <p className="text-sm">Apaga a conta{listings ? `, os seus ${listings} anúncios` : ""} e os favoritos. Não pode ser desfeito.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Input form="apagar" name="confirmText" label='Escreva "APAGAR"' error={e.confirmText} />
          <Input form="apagar" name="password" label="Password atual" type="password" error={e.password} autoComplete="current-password" />
        </div>
        <div><button className="btn bg-danger text-white">Apagar a minha conta</button></div>
      </form>
    </details>
  );
}
