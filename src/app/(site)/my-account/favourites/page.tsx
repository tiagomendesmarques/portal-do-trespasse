import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/shell";
import { ListingCard } from "@/components/listings/listing-card";
import { removeFavoriteAction } from "@/lib/account/actions";
import { accountCounts, myFavoriteIds } from "@/lib/account/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { toCards } from "@/lib/listings/queries";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false } };

export default async function FavouritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/my-account/favourites/");
  const [cards, counts] = await Promise.all([myFavoriteIds(user.id).then(toCards), accountCounts(user.id)]);
  return (
    <AccountShell user={user} active="favoritos" title="Favoritos" counts={counts}>
      {cards.length === 0 ? (
        <div className="panel py-10 text-center">
          <h2 className="text-xl font-bold">Ainda não guardou anúncios</h2>
          <p className="mt-1 text-muted">Use &quot;Guardar nos favoritos&quot; num anúncio para o encontrar aqui.</p>
          <Link href="/all-ads/" className="btn-primary mt-4">Ver anúncios</Link>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {cards.map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <ListingCard item={c} />
              <form action={removeFavoriteAction}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-sm text-muted underline">Remover dos favoritos</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
