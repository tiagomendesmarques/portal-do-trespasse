import { permanentRedirect } from "next/navigation";

// Sitemap nativo do WordPress.
export function GET() {
  permanentRedirect("/sitemap.xml");
}
