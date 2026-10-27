import { absoluteUrl } from "@/lib/site";

/** Valores de exemplo para pré-visualizar e testar os modelos de email. */
export function sampleVars(name = "Ana Ribeiro") {
  return {
    name,
    user_name: "Ana Ribeiro",
    user_email: "ana.ribeiro@exemplo.pt",
    listing_title: "Café com esplanada em Almada",
    listing_url: absoluteUrl("/listing/exemplo/"),
    expires_at: "24 de fevereiro de 2027",
    duration_days: 120,
    category_name: "Restauração",
    reason: "Faltam informações essenciais (valor, localização ou descrição do negócio).",
    sender_name: "João Silva",
    sender_email: "joao.silva@exemplo.pt",
    sender_phone: "912 345 678",
    message: "Olá, tenho interesse no seu anúncio. Podemos marcar uma visita?",
    change: "A password foi alterada",
    date: new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }),
    action: "publicou",
    verify_url: absoluteUrl("/my-account/verify/?token=exemplo"),
    reset_url: absoluteUrl("/my-account/reset-password/?token=exemplo"),
    reset_request_url: absoluteUrl("/my-account/lost-password/"),
    post_url: absoluteUrl("/post-an-ad/"),
    login_url: absoluteUrl("/my-account/"),
    renew_url: absoluteUrl("/my-account/listings/"),
    edit_url: absoluteUrl("/my-account/listings/"),
    account_listings_url: absoluteUrl("/my-account/listings/"),
    admin_listing_url: absoluteUrl("/admin/anuncios/"),
    admin_user_url: absoluteUrl("/admin/utilizadores/"),
    admin_reports_url: absoluteUrl("/admin/denuncias/"),
  };
}
