import { describe, expect, it } from "vitest";
import { htmlToText, textToHtml } from "./description";
import { isFieldVisible, validateListing, type Context, type FieldDef, type ListingInput } from "./validation";

const F = (o: Partial<FieldDef> & Pick<FieldDef, "id" | "key" | "type">): FieldDef => ({ label: o.key, options: [], required: false, min: null, max: null, condition: null, ...o });
const yesNo = [{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }];
const FIELDS: FieldDef[] = [
  F({ id: 1, key: "renda-mensal", type: "number" }),
  F({ id: 2, key: "trabalhadores", type: "radio", options: yesNo }),
  F({ id: 3, key: "quantos", type: "number", min: 0, condition: { fieldId: 2, operator: "==", value: "sim" } }),
  F({ id: 4, key: "negocio-sazonal", type: "radio", options: yesNo, required: true }),
  F({ id: 5, key: "presenca", type: "checkbox", options: [{ value: "espaco-fisico", label: "Espaço Físico" }, { value: "online", label: "Online" }], required: true }),
];
const CTX: Context = { fields: FIELDS, typeKeys: ["trespasse"], categoryIds: [10], locationIds: [200], imagePrefix: "listings/u7/", limits: { titleMax: 45, descriptionMax: 2000, maxImages: 9 } };
const OK: ListingInput = {
  typeKey: "trespasse", categoryId: 10, locationId: 200, title: "Café com esplanada em Almada",
  description: "Café de bairro com clientela fixa há 12 anos, esplanada com 20 lugares e cozinha equipada.",
  priceType: "negotiable", price: "45.000", priceUnit: "total", phone: "912 345 678", features: "- Cozinha equipada\n- Esplanada\n\n",
  images: ["listings/u7/abc", "listings/u7/abc"], fields: { "renda-mensal": "800", trabalhadores: "nao", quantos: "3", "negocio-sazonal": "nao", presenca: ["espaco-fisico"] },
};

describe("validateListing", () => {
  it("aceita um anúncio válido e normaliza valores", () => {
    const r = validateListing(OK, CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.price).toBe(45000);
    expect(r.data.features).toEqual(["Cozinha equipada", "Esplanada"]);
    expect(r.data.images).toEqual(["listings/u7/abc"]);
    // "quantos" fica de fora porque só se aplica quando há trabalhadores.
    expect(r.data.values).toEqual([{ fieldId: 1, value: 800 }, { fieldId: 2, value: "nao" }, { fieldId: 4, value: "nao" }, { fieldId: 5, value: ["espaco-fisico"] }]);
  });

  it("valida o campo condicional quando a condição se verifica", () => {
    const r = validateListing({ ...OK, fields: { ...OK.fields, trabalhadores: "sim", quantos: "-1" } }, CTX);
    expect(r.ok === false && r.errors["field.quantos"]).toBe("Insira um valor maior ou igual a 0.");
  });

  it("exige campos obrigatórios e recusa opções inventadas", () => {
    const r = validateListing({ ...OK, fields: { presenca: ["drive-thru"] } }, CTX);
    expect(r.ok === false && r.errors).toMatchObject({ "field.negocio-sazonal": "Este campo é obrigatório.", "field.presenca": "Opção inválida." });
  });

  it("limita título, descrição, fotos e preço", () => {
    const r = validateListing({ ...OK, title: "x".repeat(46), description: "curta", price: "abc", images: Array.from({ length: 10 }, (_, i) => `listings/u7/i${i}`) }, CTX);
    expect(r.ok === false && r.errors).toMatchObject({ title: "Insira no máximo 45 caracteres.", description: expect.stringMatching(/50 caracteres/), price: expect.any(String), images: expect.stringMatching(/9 fotografias/) });
  });

  it("recusa fotografias de outro utilizador", () => {
    const r = validateListing({ ...OK, images: ["listings/u8/roubada"] }, CTX);
    expect(r.ok === false && r.errors.images).toBeTruthy();
  });

  it("'Sob consulta' dispensa preço", () => {
    const r = validateListing({ ...OK, priceType: "on_call", price: "" }, CTX);
    expect(r.ok && r.data.price).toBe(null);
  });

  it("isFieldVisible segue a condição", () => {
    expect(isFieldVisible(FIELDS[2], FIELDS, { trabalhadores: "sim" })).toBe(true);
    expect(isFieldVisible(FIELDS[2], FIELDS, {})).toBe(false);
  });
});

describe("descrição", () => {
  it("converte texto em HTML seguro com listas e volta a texto", () => {
    const text = "Café no centro.\nAberto desde 2010.\n\n- Esplanada\n- Cozinha\n\n<script>x</script>";
    const html = textToHtml(text);
    expect(html).toBe("<p>Café no centro.<br>Aberto desde 2010.</p>\n<ul><li>Esplanada</li><li>Cozinha</li></ul>\n<p>&lt;script&gt;x&lt;/script&gt;</p>");
    expect(htmlToText(html)).toBe(text);
  });
});
