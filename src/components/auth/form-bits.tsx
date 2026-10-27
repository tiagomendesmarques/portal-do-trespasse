"use client";

import { useFormStatus } from "react-dom";

type FieldProps = {
  /** Prefixo do formulário, para os ids não colidirem quando há dois formulários na página. */
  form: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
  autoComplete?: string;
};

export function Field({ form, name, label, type = "text", required, hint, error, defaultValue, autoComplete }: FieldProps) {
  const id = `${form}-${name}`;
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </span>
      {hint && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      <input
        id={id}
        name={name}
        type={type}
        className="input"
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
      />
      {error && <span className="err" id={`${id}-err`}>{error}</span>}
    </label>
  );
}

export function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Aguarde…" : children}
    </button>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "ok" | "error"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-ok-wash text-ok" : tone === "error" ? "bg-danger-wash text-danger" : "bg-wash text-ink";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-md px-3.5 py-2.5 text-sm font-medium ${cls}`}>{children}</div>;
}
