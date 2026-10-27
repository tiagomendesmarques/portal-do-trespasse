import { describe, expect, it } from "vitest";
import { filtersToQuery, parseFilters, searchTerms } from "./filters";

const FIELDS = [{ key: "renda-mensal", type: "number" }, { key: "trabalhadores-com-contrato", type: "radio" }];

describe("parseFilters", () => {
  it("lê filtros válidos e ignora lixo", () => {
    const f = parseFilters({ q: " café ", tipo: "trespasse", distrito: "lisboa", concelho: "<script>", preco_min: "10.000", orderby: "price-asc", pagina: "2" }, FIELDS);
    expect(f).toMatchObject({ q: "café", type: "trespasse", distrito: "lisboa", concelho: null, priceMin: 10000, sort: "price-asc", page: 2 });
  });
  it("aceita os valores de ordenação do WordPress e recusa desconhecidos", () => {
    expect(parseFilters({ orderby: "views-desc" }).sort).toBe("views-desc");
    expect(parseFilters({ orderby: "rand" }).sort).toBe("date-desc");
  });
  it("lê filtros de campos personalizados", () => {
    const f = parseFilters({ "renda-mensal_max": "1500", "trabalhadores-com-contrato": "sim" }, FIELDS);
    expect(f.fields).toEqual([{ key: "renda-mensal", max: 1500 }, { key: "trabalhadores-com-contrato", equals: "sim" }]);
  });
});

describe("filtersToQuery", () => {
  it("é o inverso de parseFilters e omite valores por omissão", () => {
    const sp = { q: "cafe", distrito: "porto", "renda-mensal_max": "900", orderby: "price-desc", pagina: "3" };
    const f = parseFilters(sp, FIELDS);
    expect(parseFilters(Object.fromEntries(new URLSearchParams(filtersToQuery(f))), FIELDS)).toEqual(f);
    expect(filtersToQuery(parseFilters({}))).toBe("");
  });
  it("permite mudar a página mantendo os filtros", () => {
    expect(filtersToQuery(parseFilters({ q: "loja" }), { page: 2 })).toBe("?q=loja&pagina=2");
  });
});

describe("searchTerms", () => {
  it("normaliza acentos e ignora termos curtos", () => {
    expect(searchTerms("Café e Snack-Bar em Évora")).toEqual(["cafe", "snack", "bar", "em", "evora"]);
  });
});
