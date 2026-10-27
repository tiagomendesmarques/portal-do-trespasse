import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeleteAccountForm, EmailForm, PasswordForm, ProfileForm } from "@/components/account/forms";
import { AccountShell } from "@/components/account/shell";
import { accountCounts } from "@/lib/account/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { getTaxonomies } from "@/lib/listings/queries";

export const metadata: Metadata = { title: "Editar conta", robots: { index: false } };

export default async function EditAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/my-account/edit-account/");
  const [tax, counts] = await Promise.all([getTaxonomies(), accountCounts(user.id)]);
  return (
    <AccountShell user={user} active="conta" title="Editar conta" counts={counts}>
      <ProfileForm user={user} distritos={tax.distritos.map((d) => ({ id: d.id, name: d.name }))} />
      <EmailForm email={user.email} />
      <PasswordForm />
      {user.role !== "admin" && <DeleteAccountForm listings={counts.anuncios} />}
    </AccountShell>
  );
}
