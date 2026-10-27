import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/shell";
import { accountCounts, myMessages } from "@/lib/account/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Mensagens", robots: { index: false } };

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/my-account/messages/");
  const [msgs, counts] = await Promise.all([myMessages(user.id), accountCounts(user.id)]);
  return (
    <AccountShell user={user} active="mensagens" title="Mensagens recebidas" counts={counts}>
      <p className="text-sm text-muted">Também recebe cada mensagem por email. Para responder, use o email ou o telefone do interessado.</p>
      {msgs.length === 0 && <div className="panel py-10 text-center text-muted">Ainda não recebeu mensagens.</div>}
      {msgs.map((m) => (
        <article key={m.id} className="panel flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-sans text-base font-bold">{m.name}</h2>
            <span className="text-xs text-muted">{relativeTime(m.createdAt)}</span>
          </div>
          {m.listingSlug && <p className="text-sm">Sobre <Link href={`/listing/${m.listingSlug}/`} className="text-accent">{m.listingTitle}</Link></p>}
          <p className="whitespace-pre-line">{m.body}</p>
          <p className="flex flex-wrap gap-x-4 text-sm">
            <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.listingTitle ?? "o seu contacto"}`)}`} className="text-accent">{m.email}</a>
            {m.phone && <a href={`tel:${m.phone.replace(/\s/g, "")}`} className="text-accent tabular-nums">{m.phone}</a>}
          </p>
        </article>
      ))}
    </AccountShell>
  );
}
