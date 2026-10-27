import { z } from "zod";

const REQUIRED = "Este campo é obrigatório.";

export const usernameSchema = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .min(3, "O nome de utilizador tem de ter pelo menos 3 caracteres.")
  .max(40, "O nome de utilizador pode ter no máximo 40 caracteres.")
  .regex(/^[\p{L}\p{N}._-]+$/u, "Use só letras, números, pontos, hífens ou underscores (sem espaços nem @).");

export const emailSchema = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(200)
  .email("Por favor insira um endereço de e-mail válido.")
  .transform((e) => e.toLowerCase());

export const passwordSchema = z
  .string()
  .min(1, REQUIRED)
  .min(8, "A password tem de ter pelo menos 8 caracteres.")
  .max(200, "A password pode ter no máximo 200 caracteres.");

const phoneSchema = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === "" || /^\+?[0-9 ()-]{9,20}$/.test(v), "Indique um número de telefone válido.")
  .optional()
  .transform((v) => v || null);

export const registerSchema = z
  .object({
    phone: phoneSchema,
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    password2: z.string().min(1, REQUIRED),
    privacy: z.literal("on", { error: "Tem de aceitar a política de privacidade." }),
  })
  .refine((d) => d.password === d.password2, {
    path: ["password2"],
    message: "As passwords não coincidem.",
    // Mostra este erro mesmo quando outros campos também falham.
    when: (p) => { const v = p.value as { password?: unknown; password2?: unknown }; return typeof v.password === "string" && typeof v.password2 === "string" && v.password2 !== ""; },
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, REQUIRED).max(200),
  password: z.string().min(1, REQUIRED).max(4096),
  remember: z.string().optional(),
  next: z.string().optional(),
});

export const resetSchema = z
  .object({ token: z.string().min(1), password: passwordSchema, password2: z.string().min(1, REQUIRED) })
  .refine((d) => d.password === d.password2, {
    path: ["password2"],
    message: "As passwords não coincidem.",
    // Mostra este erro mesmo quando outros campos também falham.
    when: (p) => { const v = p.value as { password?: unknown; password2?: unknown }; return typeof v.password === "string" && typeof v.password2 === "string" && v.password2 !== ""; },
  });

export type FieldErrors = Record<string, string>;

/** Primeiro erro por campo, no formato que os formulários mostram. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

/** Só aceita caminhos internos para o redirect depois do login. */
export function safeNext(next: string | undefined | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
