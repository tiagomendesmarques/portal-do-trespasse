import { readMedia } from "@/lib/media";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const file = path.join("/");
  if (!/^[\w./-]+\.webp$/.test(file) || file.includes("..")) return new Response("Not found", { status: 404 });
  const data = await readMedia(file);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
