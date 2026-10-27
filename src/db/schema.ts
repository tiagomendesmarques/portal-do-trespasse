import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ---------- Utilizadores e sessões ---------- */

export const userRole = pgEnum("user_role", ["user", "editor", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "blocked"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    wpId: integer("wp_id").unique(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    // Pode ser um hash do WordPress ($wp$2y$…, $P$…) até ao primeiro login.
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    website: text("website"),
    address: text("address"),
    zipcode: text("zipcode"),
    locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
    avatarKey: text("avatar_key"),
    role: userRole("role").notNull().default("user"),
    status: userStatus("status").notNull().default("active"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    remindersOptOut: boolean("reminders_opt_out").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_username_lower").on(sql`lower(${t.username})`),
    uniqueIndex("users_email_lower").on(sql`lower(${t.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 do token guardado no cookie; o token em claro nunca é guardado.
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const tokenType = pgEnum("token_type", ["verify_email", "reset_password"]);

export const userTokens = pgTable(
  "user_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: tokenType("type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_tokens_user").on(t.userId, t.type)],
);

/* ---------- Taxonomias ---------- */

export const listingTypes = pgTable("listing_types", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  wpId: integer("wp_id").unique(),
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  wpSlug: text("wp_slug"),
  icon: text("icon"),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const locationLevel = pgEnum("location_level", ["distrito", "concelho"]);

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    wpId: integer("wp_id"),
    parentId: integer("parent_id").references((): AnyPgColumn => locations.id, { onDelete: "cascade" }),
    level: locationLevel("level").notNull(),
    name: text("name").notNull(),
    // Slug igual ao do WordPress, para manter /listing-location/{distrito}/{concelho}/.
    slug: text("slug").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  // NULLS NOT DISTINCT: dois distritos (parent NULL) com o mesmo slug também colidem.
  (t) => [unique("locations_parent_slug").on(t.parentId, t.slug).nullsNotDistinct(), index("locations_parent").on(t.parentId)],
);

/* ---------- Campos personalizados ---------- */

export const fieldType = pgEnum("field_type", ["number", "text", "textarea", "radio", "checkbox", "select"]);

export type FieldOption = { value: string; label: string };
export type FieldCondition = { fieldId: number; operator: "=="; value: string };

export const customFields = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  wpId: integer("wp_id").unique(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  type: fieldType("type").notNull(),
  options: jsonb("options").$type<FieldOption[]>().notNull().default([]),
  required: boolean("required").notNull().default(false),
  searchable: boolean("searchable").notNull().default(false),
  listable: boolean("listable").notNull().default(true),
  help: text("help"),
  placeholder: text("placeholder"),
  icon: text("icon"),
  // Secção do formulário e da "Visão geral" (ver lib/listings/sections.ts).
  section: text("section"),
  min: integer("min"),
  max: integer("max"),
  condition: jsonb("condition").$type<FieldCondition | null>(),
  // null = aplica-se a todos.
  listingTypes: text("listing_types").array(),
  categoryIds: integer("category_ids").array(),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/* ---------- Anúncios ---------- */

export const listingStatus = pgEnum("listing_status", ["draft", "pending", "published", "rejected", "expired", "sold"]);
export const priceType = pgEnum("price_type", ["fixed", "negotiable", "on_call"]);
export const priceUnit = pgEnum("price_unit", ["total", "month"]);

export type BusinessHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  { mode: "hours"; open: string; close: string } | { mode: "24h" } | { mode: "closed" }
>;

export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    wpId: integer("wp_id").unique(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull().references(() => listingTypes.key),
    categoryId: integer("category_id").notNull().references(() => categories.id),
    // Normalmente um concelho (o distrito obtém-se pelo parent); anúncios antigos podem apontar só para o distrito.
    locationId: integer("location_id").notNull().references(() => locations.id),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull(),
    priceType: priceType("price_type").notNull().default("fixed"),
    price: integer("price"),
    priceUnit: priceUnit("price_unit"),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    website: text("website"),
    address: text("address"),
    zipcode: text("zipcode"),
    videoUrls: text("video_urls").array().notNull().default(sql`'{}'::text[]`),
    businessHours: jsonb("business_hours").$type<BusinessHours | null>(),
    status: listingStatus("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    topUntil: timestamp("top_until", { withTimezone: true }),
    views: integer("views").notNull().default(0),
    phoneClicks: integer("phone_clicks").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiryWarnedAt: timestamp("expiry_warned_at", { withTimezone: true }),
    // Título + descrição + características, em minúsculas e sem acentos (ver lib/text.ts).
    searchText: text("search_text").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    index("listings_status_published").on(t.status, t.publishedAt),
    index("listings_category").on(t.categoryId),
    index("listings_location").on(t.locationId),
    index("listings_user").on(t.userId),
  ],
);

export const listingImages = pgTable(
  "listing_images",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    // Caminho no bucket, sem extensão de tamanho (ex.: listings/123/abc).
    storageKey: text("storage_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    sort: integer("sort").notNull().default(0),
    wpAttachmentId: integer("wp_attachment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_images_listing").on(t.listingId, t.sort)],
);

export const listingFieldValues = pgTable(
  "listing_field_values",
  {
    listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    fieldId: integer("field_id").notNull().references(() => customFields.id, { onDelete: "cascade" }),
    // número, texto ou lista de valores (checkbox).
    value: jsonb("value").$type<number | string | string[]>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.fieldId] })],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

export const reportStatus = pgEnum("report_status", ["open", "resolved"]);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull().references(() => listings.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  status: reportStatus("status").notNull().default("open"),
  resolvedBy: integer("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageKind = pgEnum("message_kind", ["listing_contact", "site_contact"]);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    kind: messageKind("kind").notNull(),
    listingId: integer("listing_id").references(() => listings.id, { onDelete: "set null" }),
    toUserId: integer("to_user_id").references(() => users.id, { onDelete: "set null" }),
    fromUserId: integer("from_user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    body: text("body").notNull(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_to_user").on(t.toUserId)],
);

/* ---------- Emails ---------- */

export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
  subject: text("subject").notNull(),
  heading: text("heading").notNull(),
  // Texto simples com {variáveis}; linhas em branco separam parágrafos; [Texto](url) vira botão.
  body: text("body").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailStatus = pgEnum("email_status", ["logged", "sent", "failed"]);

export const emailLog = pgTable(
  "email_log",
  {
    id: serial("id").primaryKey(),
    templateKey: text("template_key"),
    to: text("to").notNull(),
    replyTo: text("reply_to"),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    status: emailStatus("status").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_log_created").on(t.createdAt)],
);

/* ---------- Conteúdos ---------- */

export const contentStatus = pgEnum("content_status", ["draft", "published"]);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    wpId: integer("wp_id").unique(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    contentHtml: text("content_html").notNull(),
    featuredImageKey: text("featured_image_key"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: contentStatus("status").notNull().default("draft"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("posts_published").on(t.status, t.publishedAt)],
);

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  status: contentStatus("status").notNull().default("published"),
  ...timestamps,
});

export const redirects = pgTable("redirects", {
  id: serial("id").primaryKey(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  statusCode: integer("status_code").notNull().default(301),
  hits: integer("hits").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Sistema ---------- */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity").on(t.entity, t.entityId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});
