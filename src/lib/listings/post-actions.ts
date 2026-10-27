"use server";

import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyAdmins, sendTemplate } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { activeListingCount, applicableFields, asFieldDefs, loadFormContext, saveListing } from "./manage";
import { validateListing, type ListingInput } from "./validation";

export type PostState = { errors?: Record<string, string>; message?: string };

function readInput(fd: FormData): ListingInput {
  const fields: ListingInput["fields"] = {};
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("f:")) continue;
    const key = k.slice(2);
    const all = fd.getAll(k).map(String);
    fields[key] = all.length > 1 || fd.get(`multi:${key}`) ? all : String(v);
  }
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    typeKey: s("typeKey"), categoryId: Number(s("categoryId")), locationId: Number(s("locationId")), title: s("title"),
    description: s("description"), priceType: s("priceType"), price: s("price"), priceUnit: s("priceUnit"), phone: s("phone"),
    features: s("features"), images: fd.getAll("images").map(String).filter(Boolean), fields,
  };
}

export async function saveListingAction(_: PostState, fd: FormData): Promise<PostState> {
  const user = await getCurrentUser();
  if (!user) return { message: "A sua sessão terminou. Entre outra vez para publicar (o rascunho fica guardado neste browser)." };
  if (!user.emailVerifiedAt) return { message: "Confirme o seu email antes de publicar." };
  if (!(await rateLimit(`post:${user.id}`, 30, 3600))) return { message: "Fez muitas alterações seguidas. Tente daqui a pouco." };

  const editId = Number(fd.get("editId")) || undefined;
  const isStaff = user.role === "admin" || user.role === "editor";
  const db = getDb();
  let previous: typeof schema.listings.$inferSelect | undefined;
  if (editId) {
    previous = await db.query.listings.findFirst({ where: (l, { eq }) => eq(l.id, editId) });
    if (!previous || (previous.userId !== user.id && !isStaff)) return { message: "Não pode editar este anúncio." };
  } else {
    const limit = (await getSettings(["listings.freeAdsPerUser"]))["listings.freeAdsPerUser"];
    if ((await activeListingCount(user.id)) >= limit) return { message: `Já tem ${limit} anúncios ativos, o máximo do plano grátis. Marque como vendido ou apague um anúncio antes de publicar outro.` };
  }

  const ctx = await loadFormContext();
  const input = readInput(fd);
  const result = validateListing(input, {
    fields: asFieldDefs(applicableFields(ctx.fields, input.typeKey, input.categoryId)),
    typeKeys: ctx.types.map((t) => t.key),
    categoryIds: ctx.categories.map((c) => c.id),
    // Anúncios novos exigem concelho; os antigos que só tinham distrito podem mantê-lo.
    locationIds: editId && previous ? [...ctx.distritos.flatMap((d) => d.concelhos.map((c) => c.id)), previous.locationId] : ctx.distritos.flatMap((d) => d.concelhos.map((c) => c.id)),
    imagePrefix: "listings/",
    limits: ctx.limits,
  });
  if (!result.ok) return { errors: result.errors, message: "Há campos por corrigir. Veja as mensagens a vermelho." };

  // Fotos: só as carregadas por quem edita, pelo dono, ou as que o anúncio já tinha.
  const ownerId = previous?.userId ?? user.id;
  const existing = editId ? (await db.query.listingImages.findMany({ where: (i, { eq }) => eq(i.listingId, editId) })).map((i) => i.storageKey) : [];
  if (result.data.images.some((k) => !k.startsWith(`listings/u${user.id}/`) && !k.startsWith(`listings/u${ownerId}/`) && !existing.includes(k))) {
    return { errors: { images: "Fotografia inválida. Volte a carregá-la." } };
  }

  // A equipa a editar o anúncio de outra pessoa: mantém o estado e não envia emails.
  const staffEdit = Boolean(editId && previous && previous.userId !== user.id && isStaff);
  const settings = await getSettings(["listings.moderation", "listings.moderateEdits", "listings.durationDays"]);
  const wasPublic = previous && ["published", "sold"].includes(previous.status);
  const status = staffEdit
    ? previous!.status
    : editId
      ? wasPublic && !settings["listings.moderateEdits"] ? previous!.status : "pending"
      : settings["listings.moderation"] ? "pending" : "published";

  const listing = await saveListing(ownerId, result.data, { editId, status, durationDays: settings["listings.durationDays"], firstPublish: !editId });
  await db.insert(schema.auditLog).values({ actorId: user.id, action: staffEdit ? "listing.staff_edit" : editId ? "listing.edit" : "listing.create", entity: "listing", entityId: String(listing.id), data: { status } });

  if (staffEdit) redirect(`/admin/anuncios/${listing.id}/?editado=1`);
  if (status === "pending") {
    await sendTemplate(editId ? "listing_edited" : "listing_submitted", user.email, {
      name: user.displayName, listing_title: listing.title, account_listings_url: absoluteUrl("/my-account/listings/"),
    });
    await notifyAdmins("admin_listing_pending", {
      user_name: user.displayName, action: editId ? "editou" : "publicou", listing_title: listing.title,
      admin_listing_url: absoluteUrl(`/admin/anuncios/${listing.id}/`),
    });
  }
  redirect(`/my-account/listings/?${editId ? "editado" : "enviado"}=${listing.id}`);
}
