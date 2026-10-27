import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { mediaUrl, storeImage } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";

const FORMATS = new Set(["jpeg", "png", "webp"]);

/** Carrega uma fotografia de anúncio. Devolve a chave a enviar com o formulário. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Inicie sessão para carregar fotografias." }, { status: 401 });
  if (!(await rateLimit(`upload:${user.id}`, 100, 3600))) return Response.json({ error: "Carregou muitas fotografias na última hora. Tente mais tarde." }, { status: 429 });

  const { "listings.maxImageMb": maxMb } = await getSettings(["listings.maxImageMb"]);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Nenhum ficheiro recebido." }, { status: 400 });
  if (file.size > maxMb * 1024 * 1024) return Response.json({ error: `A imagem tem mais de ${maxMb} MB. Reduza-a e tente de novo.` }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  // Confirma o formato pelo conteúdo, não pelo nome do ficheiro.
  const meta = await sharp(buf).metadata().catch(() => null);
  if (!meta?.format || !FORMATS.has(meta.format)) return Response.json({ error: "Formato não suportado. Use JPG, PNG ou WEBP." }, { status: 415 });
  if ((meta.width ?? 0) < 300 || (meta.height ?? 0) < 200) return Response.json({ error: "A imagem é demasiado pequena (mínimo 300 × 200 píxeis)." }, { status: 422 });

  // A equipa também carrega imagens de destaque do blog.
  const isStaff = user.role === "admin" || user.role === "editor";
  const folder = new URL(req.url).searchParams.get("tipo") === "blog" && isStaff ? "blog" : "listings";
  const key = `${folder}/u${user.id}/${randomUUID()}`;
  const dims = await storeImage(key, buf);
  return Response.json({ key, url: mediaUrl(key, 400), ...dims });
}
