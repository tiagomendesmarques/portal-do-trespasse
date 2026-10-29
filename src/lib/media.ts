import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import sharp from "sharp";

/**
 * Imagens guardadas em vários tamanhos WebP, sempre servidas por /media/{key}-{w}.webp.
 * MEDIA_DRIVER=local (desenvolvimento): pasta MEDIA_DIR. MEDIA_DRIVER=gcs (Cloud Run): bucket GCS_BUCKET.
 */
export const IMAGE_WIDTHS = [400, 800, 1600] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

/** Onde ficam os ficheiros. Os nomes são relativos (ex.: "listings/12/3456-800.webp"). */
type Store = {
  put(file: string, data: Buffer): Promise<void>;
  get(file: string): Promise<Buffer | null>;
  /** Todos os ficheiros, com a data da última alteração. */
  list(): Promise<Map<string, Date>>;
  remove(file: string): Promise<void>;
};

// Lido a cada chamada (e não ao carregar o módulo), para os scripts e testes poderem mudá-lo.
const mediaDir = () => process.env.MEDIA_DIR ?? "./.data/media";

function pathFor(file: string) {
  const p = normalize(join(/*turbopackIgnore: true*/ mediaDir(), file));
  if (!p.startsWith(normalize(mediaDir()))) throw new Error("caminho inválido");
  return p;
}

const localStore: Store = {
  async put(file, data) {
    const p = pathFor(file);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  },
  async get(file) {
    try {
      return await readFile(pathFor(file));
    } catch {
      return null;
    }
  },
  async list() {
    const out = new Map<string, Date>();
    let entries: string[];
    try {
      entries = await readdir(/*turbopackIgnore: true*/ mediaDir(), { recursive: true });
    } catch {
      return out;
    }
    for (const rel of entries) {
      if (!rel.endsWith(".webp")) continue;
      out.set(rel.split(sep).join("/"), (await stat(pathFor(rel))).mtime);
    }
    return out;
  },
  async remove(file) {
    await rm(pathFor(file), { force: true });
  },
};

type Bucket = import("@google-cloud/storage").Bucket;
const gcs = globalThis as unknown as { __pdtBucket?: { name: string; bucket: Promise<Bucket> } };
function bucket(): Promise<Bucket> {
  const name = process.env.GCS_BUCKET;
  if (!name) throw new Error("MEDIA_DRIVER=gcs precisa de GCS_BUCKET");
  // Carregado só quando é usado: em desenvolvimento a biblioteca nem é lida.
  if (gcs.__pdtBucket?.name !== name) {
    gcs.__pdtBucket = { name, bucket: import("@google-cloud/storage").then(({ Storage }) => new Storage().bucket(name)) };
  }
  return gcs.__pdtBucket.bucket;
}
const notFound = (e: unknown) => (e as { code?: number }).code === 404;

const gcsStore: Store = {
  async put(file, data) {
    await (await bucket()).file(file).save(data, {
      resumable: false,
      contentType: "image/webp",
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
  },
  async get(file) {
    try {
      const [data] = await (await bucket()).file(file).download();
      return data;
    } catch (e) {
      if (notFound(e)) return null;
      throw e;
    }
  },
  async list() {
    const [files] = await (await bucket()).getFiles({ autoPaginate: true });
    return new Map(files.filter((f) => f.name.endsWith(".webp")).map((f) => [f.name, new Date(String(f.metadata.updated ?? f.metadata.timeCreated ?? 0))]));
  },
  async remove(file) {
    await (await bucket()).file(file).delete({ ignoreNotFound: true });
  },
};

const store = (): Store => (process.env.MEDIA_DRIVER === "gcs" ? gcsStore : localStore);

export async function storeImage(key: string, input: Buffer): Promise<{ width: number; height: number }> {
  const img = sharp(input, { failOn: "none" }).rotate(); // aplica a orientação EXIF
  const meta = await img.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  for (const w of IMAGE_WIDTHS) {
    const out = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await store().put(`${key}-${w}.webp`, out);
  }
  return { width, height };
}

export async function readMedia(file: string): Promise<Buffer | null> {
  return store().get(file);
}

export function mediaUrl(key: string, width: ImageWidth = 800): string {
  return `/media/${key}-${width}.webp`;
}

export function mediaSrcSet(key: string): string {
  return IMAGE_WIDTHS.map((w) => `${mediaUrl(key, w)} ${w}w`).join(", ");
}

/** Todos os ficheiros guardados (nome → data), para verificações. */
export async function listMediaFiles(): Promise<Map<string, Date>> {
  return store().list();
}

/** Chaves (sem "-{w}.webp") de todas as imagens guardadas, com a data do ficheiro mais recente. */
export async function listMediaKeys(): Promise<Map<string, Date>> {
  const keys = new Map<string, Date>();
  for (const [file, date] of await store().list()) {
    const m = file.match(/^(.+)-(\d+)\.webp$/);
    if (!m) continue;
    const prev = keys.get(m[1]);
    if (!prev || date > prev) keys.set(m[1], date);
  }
  return keys;
}

export async function deleteMedia(key: string) {
  await Promise.all(IMAGE_WIDTHS.map((w) => store().remove(`${key}-${w}.webp`)));
}
