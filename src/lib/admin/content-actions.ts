"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { FieldOption } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/lib/admin/guard";
import type { FormState } from "@/lib/auth/actions";
import { EMAIL_TEMPLATES } from "@/lib/email/defaults";
import { sendTemplate } from "@/lib/email/send";
import { FIELD_SECTIONS } from "@/lib/listings/sections";
import { SETTINGS_DEFAULTS, type SettingKey } from "@/lib/settings-defaults";
import { slugify } from "@/lib/slug";
import { excerpt } from "@/lib/text";
import { sampleVars } from "./email-samples";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const on = (fd: FormData, k: string) => fd.get(k) === "on";

async function audit(actorId: number, action: string, entity: string, entityId: string | number, data?: unknown) {
  await getDb().insert(schema.auditLog).values({ actorId, action, entity, entityId: String(entityId), data: data ?? null });
}

/* ---------- Categorias ---------- */

export async function saveCategoryAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const name = s(fd, "name");
  const slug = slugify(s(fd, "slug") || name);
  if (name.length < 2) return { errors: { name: "Indique o nome." } };
  const db = getDb();
  const clash = await db.query.categories.findFirst({ where: and(eq(schema.categories.slug, slug), id ? sql`${schema.categories.id} <> ${id}` : undefined) });
  if (clash) return { errors: { slug: "Já existe uma categoria com este endereço." } };
  const values = { name, slug, icon: s(fd, "icon") || null, description: s(fd, "description") || null, sort: Number(fd.get("sort")) || 0, active: on(fd, "active") };
  if (id) {
    const before = await db.query.categories.findFirst({ where: eq(schema.categories.id, id) });
    await db.update(schema.categories).set(values).where(eq(schema.categories.id, id));
    // Mudar o endereço cria o redirect do antigo para o novo (não se perdem links nem SEO).
    if (before && before.slug !== slug) {
      await db.insert(schema.redirects).values({ fromPath: `/listing-category/${before.slug}/`, toPath: `/listing-category/${slug}/`, note: "Mudança de endereço da categoria" })
        .onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath: `/listing-category/${slug}/` } });
    }
  } else {
    await db.insert(schema.categories).values(values);
  }
  await audit(admin.id, "category.update", "category", id ?? slug, values);
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Categoria guardada." : "Categoria criada." };
}

/* ---------- Campos do anúncio ---------- */

function parseOptions(text: string): FieldOption[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [value, ...rest] = l.split("|");
    const label = rest.join("|").trim() || value.trim();
    return { value: slugify(value.trim()) || slugify(label), label };
  });
}

export async function saveFieldAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = Number(fd.get("id")) || null;
  const db = getDb();
  const label = s(fd, "label");
  if (label.length < 2) return { errors: { label: "Indique o rótulo." } };
  const type = s(fd, "type") as "number" | "text" | "textarea" | "radio" | "checkbox" | "select";
  if (!["number", "text", "textarea", "radio", "checkbox", "select"].includes(type)) return { errors: { type: "Tipo inválido." } };
  const options = ["radio", "checkbox", "select"].includes(type) ? parseOptions(s(fd, "options")) : [];
  if (["radio", "checkbox", "select"].includes(type) && options.length < 2) return { errors: { options: "Indique pelo menos duas opções, uma por linha." } };
  const section = s(fd, "section");
  const conditionField = Number(fd.get("conditionField")) || null;
  const values = {
    label, type, options, section: FIELD_SECTIONS.some((x) => x.key === section) ? section : null,
    help: s(fd, "help") || null, placeholder: s(fd, "placeholder") || null,
    required: on(fd, "required"), searchable: on(fd, "searchable"), listable: on(fd, "listable"), active: on(fd, "active"),
    min: fd.get("min") ? Number(fd.get("min")) : null, max: fd.get("max") ? Number(fd.get("max")) : null, sort: Number(fd.get("sort")) || 0,
    icon: type === "number" && on(fd, "money") ? "money" : null,
    condition: conditionField && s(fd, "conditionValue") ? { fieldId: conditionField, operator: "==" as const, value: s(fd, "conditionValue") } : null,
    categoryIds: fd.getAll("categoryIds").map(Number).filter(Boolean),
    listingTypes: fd.getAll("listingTypes").map(String).filter(Boolean),
  };
  if (!values.categoryIds.length) (values as { categoryIds: number[] | null }).categoryIds = null;
  if (!values.listingTypes.length) (values as { listingTypes: string[] | null }).listingTypes = null;

  if (id) {
    const before = await db.query.customFields.findFirst({ where: eq(schema.customFields.id, id) });
    if (!before) return { message: "Campo não encontrado." };
    // Não deixa retirar opções que já estão em anúncios (os valores ficariam sem rótulo).
    const removed = before.options.filter((o) => !options.some((n) => n.value === o.value)).map((o) => o.value);
    if (removed.length) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.listingFieldValues)
        .where(and(eq(schema.listingFieldValues.fieldId, id), sql`(${schema.listingFieldValues.value} ?| array[${sql.join(removed.map((r) => sql`${r}`), sql`, `)}]::text[] or ${schema.listingFieldValues.value} #>> '{}' = any(array[${sql.join(removed.map((r) => sql`${r}`), sql`, `)}]::text[]))`));
      if (n > 0) return { errors: { options: `Há ${n} anúncio(s) com a opção "${removed.join(", ")}". Mude o rótulo em vez de a apagar.` } };
    }
    await db.update(schema.customFields).set({ ...values, type: before.type }).where(eq(schema.customFields.id, id));
  } else {
    const key = slugify(s(fd, "key") || label).slice(0, 50);
    if (await db.query.customFields.findFirst({ where: eq(schema.customFields.key, key) })) return { errors: { key: "Já existe um campo com esta chave." } };
    const [row] = await db.insert(schema.customFields).values({ ...values, key }).returning();
    await audit(admin.id, "field.update", "field", row.id, { created: true });
    revalidatePath("/", "layout");
    redirect(`/admin/campos/${row.id}/?criado=1`);
  }
  await audit(admin.id, "field.update", "field", id, { label });
  revalidatePath("/", "layout");
  return { ok: true, message: "Campo guardado." };
}

/* ---------- Páginas e blog ---------- */

export async function savePageAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = Number(fd.get("id"));
  const title = s(fd, "title");
  if (title.length < 2) return { errors: { title: "Indique o título." } };
  await getDb().update(schema.pages).set({
    title, contentHtml: String(fd.get("contentHtml") ?? ""), seoTitle: s(fd, "seoTitle") || null, seoDescription: s(fd, "seoDescription") || null,
    status: fd.get("status") === "draft" ? "draft" : "published", updatedAt: new Date(),
  }).where(eq(schema.pages.id, id));
  await audit(staff.id, "page.update", "page", id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Página guardada." };
}

export async function savePostAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const id = Number(fd.get("id")) || null;
  const db = getDb();
  const title = s(fd, "title");
  const slug = slugify(s(fd, "slug") || title).slice(0, 120);
  const contentHtml = String(fd.get("contentHtml") ?? "");
  const errors: Record<string, string> = {};
  if (title.length < 5) errors.title = "Indique o título.";
  if (!slug) errors.slug = "Indique o endereço.";
  if (contentHtml.trim().length < 50) errors.contentHtml = "Escreva o artigo (pelo menos 50 caracteres).";
  const pageClash = await db.query.pages.findFirst({ where: eq(schema.pages.slug, slug) });
  const postClash = await db.query.posts.findFirst({ where: and(eq(schema.posts.slug, slug), id ? sql`${schema.posts.id} <> ${id}` : undefined) });
  if (pageClash || postClash) errors.slug = "Este endereço já está em uso.";
  if (Object.keys(errors).length) return { errors };

  const status = fd.get("status") === "published" ? "published" : "draft";
  const before = id ? await db.query.posts.findFirst({ where: eq(schema.posts.id, id) }) : null;
  const values = {
    title, slug, contentHtml, excerpt: s(fd, "excerpt") || excerpt(contentHtml, 220),
    tags: s(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean), status: status as "published" | "draft",
    seoTitle: s(fd, "seoTitle") || null, seoDescription: s(fd, "seoDescription") || null,
    featuredImageKey: s(fd, "featuredImageKey") || null, updatedAt: new Date(),
    publishedAt: status === "published" ? before?.publishedAt ?? new Date() : before?.publishedAt ?? null,
  };
  if (id) {
    await db.update(schema.posts).set(values).where(eq(schema.posts.id, id));
    if (before && before.slug !== slug && before.status === "published") {
      await db.insert(schema.redirects).values({ fromPath: `/${before.slug}/`, toPath: `/${slug}/`, note: "Mudança de endereço do artigo" }).onConflictDoNothing();
    }
    await audit(staff.id, "post.update", "post", id);
  } else {
    const [row] = await db.insert(schema.posts).values({ ...values, authorId: staff.id }).returning();
    await audit(staff.id, "post.create", "post", row.id);
    revalidatePath("/", "layout");
    redirect(`/admin/blog/${row.id}/?criado=1`);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: status === "published" ? "Artigo publicado." : "Rascunho guardado." };
}

/* ---------- Emails ---------- */

export async function saveEmailTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const key = s(fd, "key");
  const op = s(fd, "op");
  const db = getDb();
  if (op === "restore") {
    const def = EMAIL_TEMPLATES.find((t) => t.key === key);
    if (!def) return { message: "Modelo desconhecido." };
    await db.update(schema.emailTemplates).set({ subject: def.subject, heading: def.heading, body: def.body, updatedAt: new Date() }).where(eq(schema.emailTemplates.key, key));
    await audit(admin.id, "email.update", "email_template", key, { restored: true });
    revalidatePath(`/admin/emails/${key}/`);
    return { ok: true, message: "Texto original reposto." };
  }
  const subject = s(fd, "subject");
  const heading = s(fd, "heading");
  const body = String(fd.get("body") ?? "").trim();
  if (!subject || !heading || body.length < 10) return { message: "Assunto, título e texto são obrigatórios." };
  await db.update(schema.emailTemplates).set({ subject, heading, body, enabled: on(fd, "enabled"), updatedAt: new Date() }).where(eq(schema.emailTemplates.key, key));
  await audit(admin.id, "email.update", "email_template", key);
  if (op === "test") {
    await sendTemplate(key, admin.email, sampleVars(admin.displayName));
    revalidatePath(`/admin/emails/${key}/`);
    return { ok: true, message: `Guardado. Email de teste enviado para ${admin.email}.` };
  }
  revalidatePath(`/admin/emails/${key}/`);
  return { ok: true, message: "Modelo guardado." };
}

/* ---------- Redirects ---------- */

export async function saveRedirectAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const norm = (p: string) => {
    const path = p.trim().replace(/^https?:\/\/[^/]+/, "");
    return path.startsWith("/") ? (path.endsWith("/") || path.includes("?") ? path : `${path}/`) : "";
  };
  const fromPath = norm(s(fd, "fromPath"));
  const toPath = /^https?:\/\//.test(s(fd, "toPath")) ? s(fd, "toPath") : norm(s(fd, "toPath"));
  if (!fromPath) return { errors: { fromPath: "Indique o endereço antigo, começado por /." } };
  if (!toPath) return { errors: { toPath: "Indique o destino." } };
  if (fromPath === toPath) return { errors: { toPath: "O destino não pode ser igual à origem." } };
  await getDb().insert(schema.redirects).values({ fromPath, toPath, statusCode: fd.get("statusCode") === "302" ? 302 : 301, note: s(fd, "note") || null })
    .onConflictDoUpdate({ target: schema.redirects.fromPath, set: { toPath, statusCode: fd.get("statusCode") === "302" ? 302 : 301 } });
  await audit(admin.id, "redirect.create", "redirect", fromPath, { toPath });
  revalidatePath("/admin/redirects/");
  return { ok: true, message: `Redirect ${fromPath} → ${toPath} guardado.` };
}

export async function deleteRedirectAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  await getDb().delete(schema.redirects).where(eq(schema.redirects.id, id));
  await audit(admin.id, "redirect.delete", "redirect", id);
  revalidatePath("/admin/redirects/");
}

/* ---------- Definições ---------- */

export async function saveSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const db = getDb();
  const errors: Record<string, string> = {};
  const changes: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(SETTINGS_DEFAULTS) as [SettingKey, unknown][]) {
    let value: unknown;
    if (typeof def === "boolean") value = on(fd, key);
    else if (typeof def === "number") {
      value = Number(fd.get(key));
      if (!Number.isFinite(value as number) || (value as number) < 0) { errors[key] = "Número inválido."; continue; }
    } else if (Array.isArray(def)) {
      value = s(fd, key).split(/[,\s;]+/).map((e) => e.toLowerCase()).filter(Boolean);
      if ((value as string[]).some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) { errors[key] = "Um dos emails não é válido."; continue; }
    } else value = s(fd, key);
    changes[key] = value;
  }
  if (Object.keys(errors).length) return { errors };
  for (const [key, value] of Object.entries(changes)) {
    await db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
  }
  await audit(admin.id, "settings.update", "settings", "geral", changes);
  revalidatePath("/", "layout");
  return { ok: true, message: "Definições guardadas." };
}
