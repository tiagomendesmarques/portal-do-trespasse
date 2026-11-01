import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/auth/form-bits";
import { ActionButton, AdminHeader } from "@/components/admin/ui";
import { deletePostAction } from "@/lib/admin/content-actions";
import { seoForPost } from "@/lib/blog/api";
import { PostForm } from "../post-form";

export const metadata = { title: "Editar artigo" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getDb().query.posts.findFirst({ where: eq(schema.posts.id, Number(id)) });
  if (!p) notFound();
  const seo = await seoForPost(p);
  return (
    <>
      <AdminHeader crumbs={[{ href: "/admin/blog/", label: "Blog" }]} title={p.title} intro={p.createdVia === "api" ? "Recebido pela API de artigos." : undefined}
        actions={<>{p.createdVia === "api" && <span className="rounded-full bg-wash px-2.5 py-1 text-xs font-bold text-accent">Via API</span>}{p.status === "published" && <a href={`/${p.slug}/`} target="_blank" rel="noreferrer" className="btn-ghost">Ver artigo</a>}<ActionButton action={deletePostAction} fields={{ id: p.id }} label="Apagar artigo" tone="danger" confirm={p.status === "published" ? "Apagar de vez. O endereço passa a levar ao blog." : "Apagar de vez este artigo."} /></>} />
      {sp.criado && <div className="mb-4"><Alert tone="ok">Artigo criado.</Alert></div>}
      <PostForm p={p} seo={seo} />
    </>
  );
}
