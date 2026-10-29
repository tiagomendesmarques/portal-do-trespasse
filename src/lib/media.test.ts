import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// CRC32C (Castagnoli), que o SDK usa para confirmar cada envio e cada leitura.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32c = (b: Buffer) => {
  let c = 0xffffffff;
  for (const byte of b) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  const out = Buffer.alloc(4);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return out.toString("base64");
};
const md5 = (b: Buffer) => createHash("md5").update(b).digest("base64");

// Imitação mínima da API JSON do Cloud Storage (a mesma que o SDK oficial usa).
const objects = new Map<string, { data: Buffer; contentType: string; cacheControl: string; updated: string }>();
const unknown: string[] = [];
const body = (req: IncomingMessage) => new Promise<Buffer>((res) => { const c: Buffer[] = []; req.on("data", (d) => c.push(d)); req.on("end", () => res(Buffer.concat(c))); });
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://x");
  const json = (code: number, o: unknown) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  const missing = () => json(404, { error: { code: 404, message: "No such object" } });
  const obj = url.pathname.match(/^(?:\/download)?(?:\/storage\/v1)?\/b\/([^/]+)\/o\/(.+)$/);
  if (req.method === "POST" && /^\/upload\/storage\/v1\/b\/[^/]+\/o$/.test(url.pathname)) {
    const raw = await body(req);
    const boundary = String(req.headers["content-type"]).match(/boundary="?([^";]+)"?/)![1];
    const parts = raw.toString("latin1").split(`--${boundary}`).slice(1, -1).map((p) => {
      const [head, ...rest] = p.split("\r\n\r\n");
      return { head, content: Buffer.from(rest.join("\r\n\r\n").replace(/\r\n$/, ""), "latin1") };
    });
    const meta = JSON.parse(parts[0].content.toString());
    const name = meta.name ?? url.searchParams.get("name");
    const updated = new Date().toISOString();
    objects.set(name, { data: parts[1].content, contentType: meta.contentType ?? "", cacheControl: meta.cacheControl ?? "", updated });
    return json(200, { name, bucket: "fotos", updated, size: String(parts[1].content.length), md5Hash: md5(parts[1].content), crc32c: crc32c(parts[1].content) });
  }
  if (req.method === "GET" && url.pathname.match(/^(?:\/storage\/v1)?\/b\/[^/]+\/o$/)) {
    return json(200, { kind: "storage#objects", items: [...objects].map(([name, o]) => ({ name, updated: o.updated })) });
  }
  if (obj && req.method === "GET") {
    const o = objects.get(decodeURIComponent(obj[2]));
    if (!o) return missing();
    if (url.searchParams.get("alt") !== "media") return json(200, { name: decodeURIComponent(obj[2]), updated: o.updated });
    res.writeHead(200, { "Content-Type": o.contentType, "x-goog-hash": `crc32c=${crc32c(o.data)},md5=${md5(o.data)}` });
    return res.end(o.data);
  }
  if (obj && req.method === "DELETE") {
    if (!objects.delete(decodeURIComponent(obj[2]))) return missing();
    res.writeHead(204);
    return res.end();
  }
  unknown.push(`${req.method} ${url.pathname}${url.search}`);
  console.log("pedido não imitado:", req.method, req.url);
  json(501, { error: { code: 501, message: "não imitado" } });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address() as { port: number };

Object.assign(process.env, { STORAGE_EMULATOR_HOST: `http://127.0.0.1:${port}`, NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost", GCS_BUCKET: "fotos" });
const media = await import("./media");
const photo = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: "#1b766f" } }).jpeg().toBuffer();

describe("fotografias no Cloud Storage (MEDIA_DRIVER=gcs)", () => {
  beforeEach(() => { process.env.MEDIA_DRIVER = "gcs"; });
  afterAll(() => { delete process.env.MEDIA_DRIVER; server.close(); });

  it("guarda 3 tamanhos WebP com cache longa e lê-os de volta", async () => {
    const dims = await media.storeImage("listings/7/123", photo);
    expect(dims).toEqual({ width: 2000, height: 1500 });
    expect([...objects.keys()].sort()).toEqual(["listings/7/123-1600.webp", "listings/7/123-400.webp", "listings/7/123-800.webp"]);
    const o = objects.get("listings/7/123-800.webp")!;
    expect(o.contentType).toBe("image/webp");
    expect(o.cacheControl).toContain("immutable");
    const back = await media.readMedia("listings/7/123-800.webp");
    expect((await sharp(back!).metadata()).width).toBe(800);
  });

  it("ficheiro inexistente devolve null (página 404, não erro)", async () => {
    expect(await media.readMedia("listings/7/nao-existe-800.webp")).toBeNull();
  });

  it("lista as chaves e apaga os 3 tamanhos", async () => {
    await media.storeImage("blog/9/capa", photo);
    expect([...(await media.listMediaKeys()).keys()].sort()).toEqual(["blog/9/capa", "listings/7/123"]);
    await media.deleteMedia("listings/7/123");
    await media.deleteMedia("listings/7/123"); // apagar duas vezes não dá erro
    expect([...(await media.listMediaKeys()).keys()]).toEqual(["blog/9/capa"]);
    expect(unknown).toEqual([]);
  });
});

describe("fotografias em disco (MEDIA_DRIVER=local)", () => {
  const dir = mkdtempSync(join(tmpdir(), "pdt-media-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("mesmo comportamento na pasta local", async () => {
    process.env.MEDIA_DIR = dir;
    await media.storeImage("listings/u1/abc", photo);
    expect((await media.listMediaFiles()).size).toBe(3);
    expect(await media.readMedia("listings/u1/abc-400.webp")).not.toBeNull();
    await media.deleteMedia("listings/u1/abc");
    expect((await media.listMediaKeys()).size).toBe(0);
    // Fora da pasta: recusado (o caminho nem chega a ser lido).
    expect(await media.readMedia("../../etc/passwd-400.webp")).toBeNull();
  });
});
