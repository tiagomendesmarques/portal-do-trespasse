import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// Vetores gerados fora deste código: phpass com passlib (Python) e "$wp$2y$" com
// bcrypt + HMAC-SHA384 tal como o WordPress 6.8 faz em wp_hash_password().
const WP = [
  ["palavra-passe", "$wp$2y$10$OBqs1miGrY7fg6qe4GWwvOpkr0G423jI88XNALYpCVbLLHyUkN9Ve"],
  ["Trespasse#2026 çã", "$wp$2y$10$YVljH6GH8Pk1R7vq0yYPs.SO5nE7RwGmBCJr7Orr1/UpiaNgS8RwC"],
] as const;
const PHPASS = [
  ["palavra-passe", "$P$Babcdefghp/UvPGGzqgM2u80PtvhbF1"],
  ["Trespasse#2026 çã", "$P$6zZ09./AbdQFMw7EUw2togfPscm0Ru."],
] as const;

describe("verifyPassword: hashes do WordPress", () => {
  it.each(WP)("aceita $wp$ bcrypt para %s", async (pw, hash) => {
    expect(await verifyPassword(pw, hash)).toEqual({ ok: true, needsRehash: true });
  });
  it.each(PHPASS)("aceita phpass $P$ para %s", async (pw, hash) => {
    expect(await verifyPassword(pw, hash)).toEqual({ ok: true, needsRehash: true });
  });
  it("aceita MD5 antigo", async () => {
    expect(await verifyPassword("antiga", "62e7fe3ef11ff30de5be9c4081a393db")).toEqual({ ok: true, needsRehash: true });
  });
  it("rejeita passwords erradas em todos os formatos", async () => {
    for (const [, hash] of [...WP, ...PHPASS]) {
      expect((await verifyPassword("errada", hash)).ok).toBe(false);
    }
    expect((await verifyPassword("errada", "62e7fe3ef11ff30de5be9c4081a393db")).ok).toBe(false);
  });
  it("não aplica trim ao verificar, tal como o WordPress", async () => {
    expect((await verifyPassword(" palavra-passe", WP[0][1])).ok).toBe(false);
  });
  it("rejeita hashes vazios ou inválidos", async () => {
    expect((await verifyPassword("x", "")).ok).toBe(false);
    expect((await verifyPassword("x", "$P$Bcurto")).ok).toBe(false);
    expect((await verifyPassword("x", "$wp$lixo-que-nao-e-bcrypt-nem-de-perto-0000000000000")).ok).toBe(false);
  });
});

describe("hashPassword", () => {
  it("gera bcrypt que não precisa de rehash", async () => {
    const hash = await hashPassword("nova-password");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("nova-password", hash)).toEqual({ ok: true, needsRehash: false });
  });
});
