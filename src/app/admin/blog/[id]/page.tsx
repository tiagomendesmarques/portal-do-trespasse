import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/auth/form-bits";
import { AdminHeader } from "@/components/admin/ui";
import { PostForm } from "../post-form";

export const metadata = { title: "Editar artigo" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getDb().query.posts.findFirst({ where: eq(schema.posts.id, Number(id)) });
  if (!p) notFound();
  return (
    <>
      <AdminHeader crumbs={[{ href: "/admin/blog/", label: "Blog" }]} title={p.title} actions={p.status === "published" ? <a href={`/${p.slug}/`} target="_blank" rel="noreferrer" className="btn-ghost">Ver artigo</a> : undefined} />
      {sp.criado && <div className="mb-4"><Alert tone="ok">Artigo criado.</Alert></div>}
      <PostForm p={p} />
    </>
  );
}
