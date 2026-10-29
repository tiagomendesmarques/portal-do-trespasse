import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SMTPServer } from "smtp-server";

// Servidor SMTP local com autenticação; as variáveis têm de existir antes de importar send.ts.
const received: { from: string; to: string[]; raw: string }[] = [];
const server = new SMTPServer({
  disabledCommands: ["STARTTLS"],
  allowInsecureAuth: true,
  onAuth(auth, _s, cb) {
    cb(auth.username === "geral@portaldotrespasse.pt" && auth.password === "certa" ? null : new Error("Credenciais inválidas"), { user: auth.username });
  },
  onRcptTo(addr, _s, cb) {
    cb(addr.address.startsWith("rejeitado") ? new Error("Caixa inexistente") : undefined);
  },
  onData(stream, session, cb) {
    let raw = "";
    stream.on("data", (c: Buffer) => (raw += c.toString()));
    stream.on("end", () => {
      received.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "", to: session.envelope.rcptTo.map((r) => r.address), raw });
      cb();
    });
  },
});
await new Promise<void>((res) => server.listen(0, "127.0.0.1", res));
const port = (server.server.address() as { port: number }).port;

Object.assign(process.env, {
  DATABASE_URL: "pglite:memory",
  EMAIL_DRIVER: "smtp",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(port),
  SMTP_USER: "geral@portaldotrespasse.pt",
  SMTP_PASSWORD: "certa",
  EMAIL_ONLY_TO: "dono@exemplo.pt, rejeitado@exemplo.pt",
});
const db = await import("@/db");
const { sendEmail, canSendTo } = await import("./send");

describe("envio por SMTP", () => {
  beforeAll(async () => {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db.getDb() as never, { migrationsFolder: "./drizzle" });
  });
  afterAll(async () => {
    await db.closeDb();
    await new Promise<void>((res) => server.close(() => res()));
  });
  const log = async () => (await db.getDb().select().from(db.schema.emailLog)).map((e) => [e.to, e.status, e.error ? "erro" : ""]);

  it("envia com autenticação, nome do remetente das definições e resposta para o interessado", async () => {
    const r = await sendEmail({ to: "dono@exemplo.pt", subject: "Olá — café", html: "<p>Olá</p>", text: "Olá", replyTo: "interessado@exemplo.pt" });
    expect(r.ok).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0].from).toBe("geral@portaldotrespasse.pt");
    expect(received[0].to).toEqual(["dono@exemplo.pt"]);
    expect(received[0].raw).toMatch(/^From: Portal do Trespasse <geral@portaldotrespasse\.pt>/m);
    expect(received[0].raw).toMatch(/^Reply-To: interessado@exemplo\.pt/m);
  });

  it("no staging, quem não está em EMAIL_ONLY_TO fica só registado", async () => {
    expect(canSendTo("Dono@Exemplo.pt")).toBe(true);
    expect(canSendTo("anunciante.real@gmail.com")).toBe(false);
    const r = await sendEmail({ to: "anunciante.real@gmail.com", subject: "x", html: "x", text: "x" });
    expect(r.ok).toBe(true);
    expect(received).toHaveLength(1);
  });

  it("uma recusa do servidor fica registada como falhada, sem lançar erro", async () => {
    const r = await sendEmail({ to: "rejeitado@exemplo.pt", subject: "x", html: "x", text: "x" });
    expect(r.ok).toBe(false);
    expect(await log()).toEqual([
      ["dono@exemplo.pt", "sent", ""],
      ["anunciante.real@gmail.com", "logged", ""],
      ["rejeitado@exemplo.pt", "failed", "erro"],
    ]);
  });
});
