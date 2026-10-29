import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { EMAIL_DRIVER } from "@/lib/email/send";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Emails" };

export default async function AdminEmails({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const db = getDb();
  const [templates, log] = await Promise.all([
    db.select().from(schema.emailTemplates).orderBy(asc(schema.emailTemplates.key)),
    db.select().from(schema.emailLog).where(sp.estado === "failed" ? eq(schema.emailLog.status, "failed") : undefined).orderBy(desc(schema.emailLog.id)).limit(100),
  ]);
  return (
    <>
      <AdminHeader title="Emails" intro={EMAIL_DRIVER === "log" ? "Modo de registo: os emails NÃO são enviados, só ficam guardados aqui (desenvolvimento)." : process.env.EMAIL_ONLY_TO ? `Staging: só são enviados emails para ${process.env.EMAIL_ONLY_TO}; os outros ficam só registados aqui.` : "Os emails são enviados por SMTP e ficam registados aqui."} />
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-bold">Modelos</h2>
        <Table head={["Modelo", "Assunto", "Estado"]}>
          {templates.map((t) => (
            <tr key={t.key}>
              <td><Link href={`/admin/emails/${t.key}/`} className="font-semibold text-accent">{t.description}</Link></td>
              <td className="text-muted">{t.subject}</td>
              <td>{t.enabled ? "Ativo" : <span className="text-warn">Desligado</span>}</td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Últimos emails {sp.estado === "failed" ? "falhados" : ""}</h2>
          <Link href={sp.estado === "failed" ? "/admin/emails/" : "/admin/emails/?estado=failed"} className="text-sm">{sp.estado === "failed" ? "Ver todos" : "Só falhados"}</Link>
        </div>
        <Table head={["Para", "Assunto", "Estado", "Quando"]} empty="Sem emails.">
          {log.map((e) => (
            <tr key={e.id}>
              <td className="text-muted">{e.to}</td>
              <td><details><summary className="cursor-pointer">{e.subject}</summary><pre className="mt-2 max-w-xl whitespace-pre-wrap text-xs">{e.text}</pre></details></td>
              <td>{e.status === "sent" ? "Enviado" : e.status === "logged" ? "Só registado" : <span className="text-danger" title={e.error ?? ""}>Falhou</span>}</td>
              <td className="whitespace-nowrap text-muted">{relativeTime(e.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
