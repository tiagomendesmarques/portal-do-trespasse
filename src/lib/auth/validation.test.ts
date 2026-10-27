import { describe, expect, it } from "vitest";
import { fieldErrors, registerSchema, safeNext } from "./validation";

const ok = { phone: "", username: "ana.ribeiro", email: "Ana@Exemplo.PT", password: "segura123", password2: "segura123", privacy: "on" };

describe("registerSchema", () => {
  it("aceita um registo válido e normaliza o email", () => {
    const r = registerSchema.safeParse(ok);
    expect(r.success && r.data.email).toBe("ana@exemplo.pt");
    expect(r.success && r.data.phone).toBe(null);
  });
  it("recusa email como nome de utilizador (evita expor emails)", () => {
    const r = registerSchema.safeParse({ ...ok, username: "ana@exemplo.pt" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!).username).toMatch(/sem espaços nem @/);
  });
  it("exige passwords iguais e privacidade aceite", () => {
    const r = registerSchema.safeParse({ ...ok, password2: "outra", privacy: undefined });
    const e = fieldErrors(r.error!);
    expect(e.password2).toBe("As passwords não coincidem.");
    expect(e.privacy).toBe("Tem de aceitar a política de privacidade.");
  });
  it("valida o telefone quando preenchido", () => {
    expect(registerSchema.safeParse({ ...ok, phone: "912 345 678" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...ok, phone: "abc" }).success).toBe(false);
  });
});

describe("safeNext", () => {
  it("só aceita caminhos internos", () => {
    expect(safeNext("/post-an-ad/")).toBe("/post-an-ad/");
    expect(safeNext("https://mau.com")).toBe(null);
    expect(safeNext("//mau.com")).toBe(null);
    expect(safeNext("/\\mau.com")).toBe(null);
    expect(safeNext(undefined)).toBe(null);
  });
});
