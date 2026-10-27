/**
 * Validação de um anúncio a partir das definições dos campos (pura, sem base de dados).
 * As mensagens seguem as do WordPress ("Este campo é obrigatório." etc.).
 */
import type { FieldCondition, FieldOption } from "@/db/schema";
import { descriptionLength } from "./description";

export type FieldDef = {
  id: number;
  key: string;
  label: string;
  type: "number" | "text" | "textarea" | "radio" | "checkbox" | "select";
  options: FieldOption[];
  required: boolean;
  min: number | null;
  max: number | null;
  condition: FieldCondition | null;
};

export type ListingInput = {
  typeKey: string;
  categoryId: number;
  locationId: number;
  title: string;
  description: string; // texto simples
  priceType: string;
  price: string;
  priceUnit: string;
  phone: string;
  features: string; // uma por linha
  images: string[];
  fields: Record<string, string | string[]>; // por chave do campo
};

export type ValidListing = {
  typeKey: string;
  categoryId: number;
  locationId: number;
  title: string;
  description: string;
  priceType: "fixed" | "negotiable" | "on_call";
  price: number | null;
  priceUnit: "total" | "month" | null;
  phone: string;
  features: string[];
  images: string[];
  values: { fieldId: number; value: number | string | string[] }[];
};

export type Limits = { titleMax: number; descriptionMax: number; maxImages: number };
export type Context = { fields: FieldDef[]; typeKeys: string[]; categoryIds: number[]; locationIds: number[]; imagePrefix: string; limits: Limits };

const REQUIRED = "Este campo é obrigatório.";

/** Um campo condicional só conta se a condição se verificar (ex.: nº de trabalhadores só se "Sim"). */
export function isFieldVisible(def: FieldDef, fields: FieldDef[], values: Record<string, string | string[]>): boolean {
  if (!def.condition) return true;
  const parent = fields.find((f) => f.id === def.condition!.fieldId);
  if (!parent || !isFieldVisible(parent, fields, values)) return false;
  const v = values[parent.key];
  return Array.isArray(v) ? v.includes(def.condition.value) : v === def.condition.value;
}

export function validateListing(input: ListingInput, ctx: Context): { ok: true; data: ValidListing } | { ok: false; errors: Record<string, string> } {
  const e: Record<string, string> = {};
  const { limits } = ctx;

  if (!ctx.typeKeys.includes(input.typeKey)) e.typeKey = "Escolha o tipo de anúncio.";
  if (!ctx.categoryIds.includes(input.categoryId)) e.categoryId = "Escolha a categoria.";
  if (!ctx.locationIds.includes(input.locationId)) e.locationId = "Escolha o distrito e o concelho.";

  const title = input.title.replace(/\s+/g, " ").trim();
  if (!title) e.title = REQUIRED;
  else if (title.length < 5) e.title = "Insira pelo menos 5 caracteres.";
  else if (title.length > limits.titleMax) e.title = `Insira no máximo ${limits.titleMax} caracteres.`;

  const len = descriptionLength(input.description);
  if (!len) e.description = REQUIRED;
  else if (len < 50) e.description = "Descreva o negócio com pelo menos 50 caracteres.";
  else if (len > limits.descriptionMax) e.description = `Insira no máximo ${limits.descriptionMax} caracteres.`;

  const priceType = (["fixed", "negotiable", "on_call"].includes(input.priceType) ? input.priceType : "") as ValidListing["priceType"];
  if (!priceType) e.priceType = REQUIRED;
  let price: number | null = null;
  if (priceType && priceType !== "on_call") {
    const digits = input.price.replace(/[\s.€]/g, "").replace(",", ".");
    if (!digits) e.price = REQUIRED;
    else if (!/^\d+(\.\d+)?$/.test(digits)) e.price = "Insira um valor em euros, só com números.";
    else if (Number(digits) > 100_000_000) e.price = "Valor demasiado alto.";
    else price = Math.round(Number(digits));
  }
  const priceUnit = priceType === "on_call" ? null : ((["total", "month"].includes(input.priceUnit) ? input.priceUnit : null) as ValidListing["priceUnit"]);

  const phone = input.phone.trim();
  if (!phone) e.phone = REQUIRED;
  else if (!/^\+?[0-9 ()-]{9,20}$/.test(phone)) e.phone = "Indique um número de telefone válido.";

  const features = input.features.split("\n").map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  if (features.length > 40) e.features = "Indique no máximo 40 características.";
  else if (features.some((f) => f.length > 150)) e.features = "Cada característica pode ter no máximo 150 caracteres.";

  const images = [...new Set(input.images)];
  if (images.length > limits.maxImages) e.images = `Pode adicionar no máximo ${limits.maxImages} fotografias.`;
  if (images.some((k) => !k.startsWith(ctx.imagePrefix) || !/^[\w/-]+$/.test(k))) e.images = "Fotografia inválida. Volte a carregá-la.";

  const values: ValidListing["values"] = [];
  for (const def of ctx.fields) {
    if (!isFieldVisible(def, ctx.fields, input.fields)) continue;
    const raw = input.fields[def.key];
    const key = `field.${def.key}`;
    if (def.type === "checkbox") {
      const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean);
      if (!list.length) { if (def.required) e[key] = REQUIRED; continue; }
      if (list.some((v) => !def.options.some((o) => o.value === v))) { e[key] = "Opção inválida."; continue; }
      values.push({ fieldId: def.id, value: list });
      continue;
    }
    const v = (Array.isArray(raw) ? raw[0] : raw ?? "").trim();
    if (!v) { if (def.required) e[key] = REQUIRED; continue; }
    if (def.type === "number") {
      const n = Number(v.replace(/[\s.€]/g, "").replace(",", "."));
      if (!Number.isFinite(n)) { e[key] = "por favor insira um número válido."; continue; }
      if (def.min != null && n < def.min) { e[key] = `Insira um valor maior ou igual a ${def.min}.`; continue; }
      if (def.max != null && n > def.max) { e[key] = `Insira um valor menor ou igual a ${def.max}.`; continue; }
      values.push({ fieldId: def.id, value: Math.round(n) });
    } else if (def.type === "radio" || def.type === "select") {
      if (!def.options.some((o) => o.value === v)) { e[key] = "Opção inválida."; continue; }
      values.push({ fieldId: def.id, value: v });
    } else {
      values.push({ fieldId: def.id, value: v.slice(0, 2000) });
    }
  }

  if (Object.keys(e).length) return { ok: false, errors: e };
  return {
    ok: true,
    data: { typeKey: input.typeKey, categoryId: input.categoryId, locationId: input.locationId, title, description: input.description.trim(), priceType, price, priceUnit, phone, features, images, values },
  };
}

/** Campos que se aplicam a um tipo e categoria (null = todos). */
export function applicableFields<T extends { listingTypes: string[] | null; categoryIds: number[] | null }>(fields: T[], typeKey: string, categoryId: number): T[] {
  return fields.filter((f) => (!f.listingTypes?.length || f.listingTypes.includes(typeKey)) && (!f.categoryIds?.length || f.categoryIds.includes(categoryId)));
}
