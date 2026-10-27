import { describe, expect, it } from "vitest";
import { sanitizeContentHtml, sanitizeListingHtml } from "./html";

describe("sanitizeListingHtml", () => {
  it("mantém formatação e remove scripts, atributos e imagens", () => {
    const out = sanitizeListingHtml('<p onclick="x()">Olá <strong>mundo</strong></p><script>alert(1)</script><img src=x onerror=alert(1)><ul><li>a</li></ul>');
    expect(out).toBe("<p>Olá <strong>mundo</strong></p><ul><li>a</li></ul>");
  });
});

describe("sanitizeContentHtml", () => {
  it("permite links seguros e marca externos como nofollow", () => {
    const out = sanitizeContentHtml('<a href="https://exemplo.com">x</a><a href="javascript:alert(1)">y</a><a href="/blog/">z</a>');
    expect(out).toContain('rel="noopener nofollow"');
    expect(out).not.toContain("javascript:");
    expect(out).toContain('<a href="/blog/">z</a>');
  });
});
