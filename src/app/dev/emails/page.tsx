import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SITE_ENV } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Caixa de correio de desenvolvimento: só existe com SITE_ENV=development. */
export default async function DevEmails() {
  if (SITE_ENV !== "development") notFound();
  const rows = await getDb().select().from(schema.emailLog).orderBy(desc(schema.emailLog.id)).limit(50);
  return (
    <div className="wrap flex flex-col gap-4 py-8">
      <h1 className="text-2xl font-extrabold">Emails registados (desenvolvimento)</h1>
      {rows.map((r) => (
        <details key={r.id} className="panel" data-email-id={r.id} data-template={r.templateKey ?? ""}>
          <summary className="cursor-pointer">
            <b>{r.subject}</b> · {r.to} · {r.status} · {r.createdAt.toISOString()}
          </summary>
          <pre className="mt-3 whitespace-pre-wrap text-sm" data-email-text>{r.text}</pre>
        </details>
      ))}
    </div>
  );
}
