import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import sharp from "sharp";

/**
 * Imagens guardadas em vários tamanhos WebP, sempre servidas por /media/{key}-{w}.webp.
 * Desenvolvimento: pasta local (MEDIA_DIR). Produção: Cloud Storage (fase 6), mesmos URLs.
 */
export const IMAGE_WIDTHS = [400, 800, 1600] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

// Lido a cada chamada (e não ao carregar o módulo), para os scripts e testes poderem mudá-lo.
const mediaDir = () => process.env.MEDIA_DIR ?? "./.data/media";

function pathFor(file: string) {
  const p = normalize(join(/*turbopackIgnore: true*/ mediaDir(), file));
  if (!p.startsWith(normalize(mediaDir()))) throw new Error("caminho inválido");
  return p;
}

export async function storeImage(key: string, input: Buffer): Promise<{ width: number; height: number }> {
  const img = sharp(input, { failOn: "none" }).rotate(); // aplica a orientação EXIF
  const meta = await img.metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  for (const w of IMAGE_WIDTHS) {
    const out = await img.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    const file = pathFor(`${key}-${w}.webp`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, out);
  }
  return { width, height };
}

export async function readMedia(file: string): Promise<Buffer | null> {
  try {
    return await readFile(pathFor(file));
  } catch {
    return null;
  }
}

export function mediaUrl(key: string, width: ImageWidth = 800): string {
  return `/media/${key}-${width}.webp`;
}

export function mediaSrcSet(key: string): string {
  return IMAGE_WIDTHS.map((w) => `${mediaUrl(key, w)} ${w}w`).join(", ");
}

/** Chaves (sem "-{w}.webp") de todas as imagens guardadas, com a data do ficheiro mais recente. */
export async function listMediaKeys(): Promise<Map<string, Date>> {
  const keys = new Map<string, Date>();
  let entries: string[];
  try {
    entries = await readdir(/*turbopackIgnore: true*/ mediaDir(), { recursive: true });
  } catch {
    return keys;
  }
  for (const rel of entries) {
    const m = rel.split(sep).join("/").match(/^(.+)-(\d+)\.webp$/);
    if (!m) continue;
    const { mtime } = await stat(pathFor(rel));
    const prev = keys.get(m[1]);
    if (!prev || mtime > prev) keys.set(m[1], mtime);
  }
  return keys;
}

export async function deleteMedia(key: string) {
  await Promise.all(IMAGE_WIDTHS.map((w) => rm(pathFor(`${key}-${w}.webp`), { force: true })));
}
