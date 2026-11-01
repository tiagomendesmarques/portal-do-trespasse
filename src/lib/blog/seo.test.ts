import { describe, expect, it } from "vitest";
import { checkSeo, internalPath, type SeoInput } from "./seo";

const para = (n: number, extra = "") => `<p>${extra} ${"palavra ".repeat(n)}</p>`;
const good: SeoInput = {
  title: "Trespasse de café em Lisboa: guia completo",
  slug: "trespasse-de-cafe-em-lisboa",
  seoTitle: "Trespasse de café em Lisboa: guia para comprar bem",
  seoDescription: "Tudo o que precisa de saber antes de um trespasse de café em Lisboa: contrato, licenças, renda e como avaliar o negócio.",
  excerpt: "Guia prático para quem quer comprar um café em Lisboa.",
  focusKeyword: "trespasse de café",
  hasFeaturedImage: true,
  featuredImageAlt: "Balcão de um café em Lisboa",
  faq: [1, 2, 3].map((i) => ({ question: `Pergunta ${i}?`, answer: "Resposta." })),
  sources: [{ title: "Portal das Finanças", url: "https://www.portaldasfinancas.gov.pt/" }],
  contentHtml: [
    para(80, "Um trespasse de café é uma boa forma de começar."),
    `<h2>Como funciona o trespasse de café</h2>`, para(140, "trespasse de café"), para(140),
    `<h2>Contrato</h2>`, para(140, `Veja <a href="/all-ads/">anúncios</a> e <a href="https://www.portaldasfinancas.gov.pt/">as Finanças</a>.`), para(140),
    `<h2>Licenças</h2>`, para(140, `Leia o <a href="/blog/">blog</a> e <a href="https://portaldotrespasse.pt/post-an-ad/">publique</a>. trespasse de café`), para(140),
    `<h2>Renda</h2>`, para(140, "trespasse de café"), para(100, `<img src="/media/blog/x-1600.webp" alt="Esplanada">`),
  ].join(""),
};

describe("checkSeo", () => {
  it("artigo bem feito: sem erros e nota alta", () => {
    const r = checkSeo({ ...good, internalLinkExists: () => true });
    expect(r.errors).toEqual([]);
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.stats.internalLinks).toBe(3);
    expect(r.stats.externalLinks).toBe(1);
    expect(r.stats.h2).toBe(4);
  });

  it("erros que impedem gravar", () => {
    const r = checkSeo({
      ...good, contentHtml: `<h1>Outro título</h1><p>curto <img src="x.jpg"></p>`, featuredImageAlt: "",
      seoTitle: "x".repeat(80), seoDescription: "y".repeat(200), faq: [{ question: "?", answer: "" }],
    });
    expect(r.errors.join(" | ")).toMatch(/palavras/);
    expect(r.errors.join(" | ")).toMatch(/<h1>/);
    expect(r.errors.join(" | ")).toMatch(/sem texto alternativo/);
    expect(r.errors.join(" | ")).toMatch(/imagem de destaque precisa/);
    expect(r.errors.join(" | ")).toMatch(/título para o Google tem 80/);
    expect(r.errors.join(" | ")).toMatch(/descrição para o Google tem 200/);
    expect(r.errors.join(" | ")).toMatch(/sem resposta/);
  });

  it("ligações internas partidas são erro", () => {
    const r = checkSeo({ ...good, internalLinkExists: (p) => p !== "/blog/" });
    expect(r.errors).toEqual(["Ligações internas para páginas que não existem: /blog/"]);
  });

  it("sem palavra-chave ou com excesso: avisos e nota mais baixa", () => {
    const none = checkSeo({ ...good, focusKeyword: "" });
    expect(none.warnings).toContain("Indique a palavra-chave principal.");
    expect(none.score).toBeLessThan(checkSeo(good).score);
    const stuffed = checkSeo({ ...good, contentHtml: good.contentHtml + "<p>" + "trespasse de café ".repeat(60) + "</p>" });
    expect(stuffed.warnings.join(" ")).toMatch(/demasiadas vezes/);
  });

  it("acentos não contam: 'cafe' encontra 'café'", () => {
    expect(checkSeo({ ...good, focusKeyword: "trespasse de cafe" }).warnings.join(" ")).not.toMatch(/não está no título/);
  });
});

describe("internalPath", () => {
  it("normaliza ligações internas e ignora externas", () => {
    expect(internalPath("/blog")).toBe("/blog/");
    expect(internalPath("https://portaldotrespasse.pt/all-ads/?q=cafe#x")).toBe("/all-ads/");
    expect(internalPath("https://www.portaldotrespasse.pt")).toBe("/");
    expect(internalPath("https://www.portaldasfinancas.gov.pt/")).toBeNull();
    expect(internalPath("//evil.com/x")).toBeNull();
    expect(internalPath("mailto:geral@portaldotrespasse.pt")).toBeNull();
  });
});
