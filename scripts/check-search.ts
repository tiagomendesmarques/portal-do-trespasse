// Verificação manual da pesquisa contra a base de dados local.
import { closeDb } from "../src/db";
import { parseFilters } from "../src/lib/listings/filters";
import { getCounts, getListingBySlug, getTaxonomies, searchListings } from "../src/lib/listings/queries";

const tax = await getTaxonomies();
const run = async (label: string, sp: Record<string, string>) => {
  const r = await searchListings(parseFilters(sp, tax.fields));
  console.log(`${label.padEnd(42)} → ${r.total} | ${r.items.slice(0, 3).map((i) => `${i.title.slice(0, 28)} (${i.price ?? "-"})`).join(" · ")}`);
};
await run("todos", {});
await run('"cafe" sem acento', { q: "cafe" });
await run('"Clínica"', { q: "Clínica" });
await run("distrito lisboa", { distrito: "lisboa" });
await run("lisboa / sintra", { distrito: "lisboa", concelho: "sintra" });
await run("restauração ordenado por preço ↑", { categoria: "restauracao", orderby: "price-asc" });
await run("renda até 800 €", { "renda-mensal_max": "800" });
await run("com trabalhadores", { "trabalhadores-com-contrato": "sim" });
await run("venda de ativos", { tipo: "venda_de_ativos" });
await run("preço 40k–100k", { preco_min: "40000", preco_max: "100000" });
await run("página 2", { pagina: "2" });
const c = await getCounts();
console.log("contagens: total", c.total, "| categorias", [...c.category.values()].join(","), "| distritos com anúncios", c.distrito.size);
const d = await getListingBySlug("trespasse-clinica-desde-2012-loja-online");
console.log("detalhe:", d?.listing.title, "|", d?.concelho?.name, d?.distrito.name, "| fotos", d?.images.length, "| autor", d?.author.displayName, "| tem passwordHash?", "passwordHash" in (d?.author ?? {}));
console.log("campos:", d?.fields.map((f) => `${f.label}: ${f.display}`).join(" | "));
await closeDb();
