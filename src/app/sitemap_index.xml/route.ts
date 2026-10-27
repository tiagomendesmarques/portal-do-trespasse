import { permanentRedirect } from "next/navigation";

// O Yoast publicava o sitemap em /sitemap_index.xml (registado na Google Search Console).
export function GET() {
  permanentRedirect("/sitemap.xml");
}
