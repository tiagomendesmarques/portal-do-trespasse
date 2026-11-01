import { describe, expect, it } from "vitest";
import { checkClaims, decodeIdToken, decodePending, encodePending, type GoogleClaims } from "./google";

const now = Date.UTC(2026, 10, 1, 12);
const base: GoogleClaims = {
  iss: "https://accounts.google.com", aud: "cliente.apps.googleusercontent.com", exp: now / 1000 + 3600,
  nonce: "n-123", sub: "1234567890", email: "Ana@Gmail.com", email_verified: true, name: "Ana Ribeiro",
};
const expected = { clientId: "cliente.apps.googleusercontent.com", nonce: "n-123", issuers: ["https://accounts.google.com", "accounts.google.com"], now };

describe("checkClaims", () => {
  it("aceita um id_token válido", () => {
    expect(checkClaims(base, expected)).toBeNull();
    expect(checkClaims({ ...base, iss: "accounts.google.com", email_verified: "true" }, expected)).toBeNull();
  });
  it("recusa outro emissor, outro destinatário, expirado ou nonce diferente", () => {
    expect(checkClaims({ ...base, iss: "https://evil.example" }, expected)).toBe("emissor");
    expect(checkClaims({ ...base, aud: "outra-app" }, expected)).toBe("destinatário");
    expect(checkClaims({ ...base, exp: now / 1000 - 3600 }, expected)).toBe("expirado");
    expect(checkClaims({ ...base, nonce: "outro" }, expected)).toBe("nonce");
    expect(checkClaims({ ...base, nonce: undefined }, expected)).toBe("nonce");
  });
  it("só aceita emails confirmados pelo Google", () => {
    expect(checkClaims({ ...base, email_verified: false }, expected)).toBe("email não confirmado");
    expect(checkClaims({ ...base, email: undefined }, expected)).toBe("email não confirmado");
  });
});

describe("id_token e cookie", () => {
  it("lê o conteúdo de um JWT", () => {
    const jwt = ["e30", Buffer.from(JSON.stringify(base)).toString("base64url"), "assinatura"].join(".");
    expect(decodeIdToken(jwt).sub).toBe("1234567890");
  });
  it("cookie volta igual e um cookie estragado é ignorado", () => {
    const p = { state: "s", nonce: "n", verifier: "v", next: "/post-an-ad/" };
    expect(decodePending(encodePending(p))).toEqual(p);
    expect(decodePending("lixo")).toBeNull();
    expect(decodePending(undefined)).toBeNull();
  });
});
