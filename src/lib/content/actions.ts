"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormState } from "@/lib/auth/actions";
import { clientIp } from "@/lib/auth/session";
import { fieldErrors } from "@/lib/auth/validation";
import { notifyAdmins, sendTemplate } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Este campo é obrigatório.").max(100),
  email: z.string().trim().email("Por favor insira um endereço de e-mail válido.").max(200),
  message: z.string().trim().min(10, "Escreva pelo menos 10 caracteres.").max(5000),
  // Campo escondido: só robôs o preenchem.
  website: z.string().max(0).optional(),
});

export async function siteContactAction(_: FormState, fd: FormData): Promise<FormState> {
  const kept = Object.fromEntries(["name", "email", "message"].map((k) => [k, String(fd.get(k) ?? "")]));
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.website) return { ok: true, message: "Mensagem enviada." }; // robô: finge sucesso
    return { errors, values: kept };
  }
  const ip = clientIp(await headers());
  if (!(await rateLimit(`site-contact:${ip ?? "sem-ip"}`, 5, 3600))) return { message: "Enviou várias mensagens. Tente mais tarde.", values: kept };
  const d = parsed.data;
  await getDb().insert(schema.messages).values({ kind: "site_contact", name: d.name, email: d.email, body: d.message, ip });
  await Promise.all([
    notifyAdmins("admin_site_contact", { sender_name: d.name, sender_email: d.email, message: d.message }),
    sendTemplate("site_contact_ack", d.email, { name: d.name }),
  ]);
  return { ok: true, message: "Mensagem enviada. Respondemos por email assim que possível." };
}
