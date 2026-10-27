import { describe, expect, it } from "vitest";
import { EMAIL_TEMPLATES } from "./defaults";
import { fill, renderEmail } from "./render";

describe("renderEmail", () => {
  it("preenche variáveis e transforma [Texto](url) em botão", () => {
    const t = { subject: "Olá {name}", heading: "Título", body: "Linha {name}\n\n[Entrar]({url})" };
    const r = renderEmail(t, { name: "Ana", url: "https://x.pt/a?b=1&c=2" });
    expect(r.subject).toBe("Olá Ana");
    expect(r.html).toContain("Linha Ana");
    expect(r.html).toContain('href="https://x.pt/a?b=1&amp;c=2"');
    expect(r.text).toContain("Entrar: https://x.pt/a?b=1&c=2");
  });

  it("escapa HTML vindo de utilizadores", () => {
    const r = renderEmail({ subject: "s", heading: "h", body: "{message}" }, { message: "<script>alert(1)</script>" });
    expect(r.html).not.toContain("<script>alert");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("variáveis em falta ficam vazias", () => {
    expect(fill("a{x}b", {})).toBe("ab");
  });

  it("todos os modelos por omissão renderizam sem chavetas por preencher", () => {
    for (const t of EMAIL_TEMPLATES) {
      const vars = Object.fromEntries([...`${t.subject}${t.heading}${t.body}`.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], "x"]));
      const r = renderEmail(t, vars);
      expect(r.html, t.key).not.toMatch(/\{\w+\}/);
    }
  });
});
