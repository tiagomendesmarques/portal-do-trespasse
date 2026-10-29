import type { Metadata } from "next";
import { Bricolage_Grotesque, Schibsted_Grotesk } from "next/font/google";
import { EMAIL_DRIVER } from "@/lib/email/send";
import { isProduction, SITE_ENV, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-bricolage" });
const body = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-schibsted" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | Trespasses e negócios à venda em Portugal`, template: `%s | ${SITE_NAME}` },
  description: "Trespasses, venda de empresas e oportunidades de investimento em Portugal. Publicar o seu anúncio é gratuito.",
  // O dev e o desenvolvimento local nunca são indexados.
  robots: isProduction ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${display.variable} ${body.variable}`}>
      <body className="flex min-h-screen flex-col font-sans text-[15px] leading-relaxed">
        {SITE_ENV !== "production" && (
          <div className="bg-warn-wash px-4 py-1.5 text-center text-xs font-semibold text-warn">
            {SITE_ENV === "staging" ? "dev" : "Desenvolvimento"}: site de testes.{" "}
            {EMAIL_DRIVER !== "smtp" ? "Os emails não são enviados." : process.env.EMAIL_ONLY_TO ? "Os emails só são enviados para a equipa." : "Os emails são enviados."}
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
