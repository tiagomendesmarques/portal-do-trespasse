import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

// Fica fora do grupo (site), por isso inclui o cabeçalho e o rodapé.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="wrap py-20 text-center">
          <h1 className="text-3xl font-extrabold">Página não encontrada</h1>
          <p className="mt-2 text-muted">O endereço pode ter mudado ou o anúncio já não estar disponível.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/all-ads/" className="btn-primary">Ver anúncios</Link>
            <Link href="/" className="btn-ghost">Página inicial</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
