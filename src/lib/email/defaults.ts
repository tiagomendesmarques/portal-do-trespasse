// Modelos de email por omissão (pt-PT). O seed copia-os para a tabela email_templates,
// onde podem ser editados no back-office. Variáveis entre {chavetas}.
// No corpo: linhas em branco separam parágrafos; uma linha "[Texto](url)" vira botão.

export type EmailTemplateDefault = {
  key: string;
  description: string;
  subject: string;
  heading: string;
  body: string;
};

export const EMAIL_TEMPLATES: EmailTemplateDefault[] = [
  {
    key: "verify_email",
    description: "Registo: pedido para confirmar o email",
    subject: "Confirme o seu email no Portal do Trespasse",
    heading: "Confirme o seu email",
    body: `Olá {name},

Obrigado por criar conta no Portal do Trespasse. Para poder publicar anúncios, confirme o seu endereço de email.

[Confirmar email]({verify_url})

A ligação é válida durante 48 horas. Se não criou esta conta, ignore este email.`,
  },
  {
    key: "welcome",
    description: "Email confirmado: boas-vindas",
    subject: "Bem-vindo ao Portal do Trespasse",
    heading: "A sua conta está pronta",
    body: `Olá {name},

O seu email está confirmado. Já pode publicar o seu negócio: demora cerca de 5 minutos e é gratuito.

[Publicar anúncio]({post_url})

Dica: anúncios com fotografias, renda e faturação indicadas recebem mais contactos.`,
  },
  {
    key: "reset_password",
    description: "Pedido de nova password",
    subject: "Definir nova password",
    heading: "Definir nova password",
    body: `Olá {name},

Recebemos um pedido para definir uma nova password na sua conta.

[Definir nova password]({reset_url})

A ligação é válida durante 1 hora. Se não fez este pedido, ignore este email: a sua password não muda.`,
  },
  {
    key: "security_notice",
    description: "Aviso de alteração de password ou email",
    subject: "A sua conta foi alterada",
    heading: "Alteração na sua conta",
    body: `Olá {name},

{change} na sua conta do Portal do Trespasse em {date}.

Se não foi você, defina uma nova password e contacte-nos.

[Definir nova password]({reset_request_url})`,
  },
  {
    key: "listing_submitted",
    description: "Anúncio enviado: confirmação ao anunciante",
    subject: "Recebemos o seu anúncio \"{listing_title}\"",
    heading: "Anúncio recebido",
    body: `Olá {name},

Recebemos o seu anúncio "{listing_title}". Vamos revê-lo e avisamos assim que estiver publicado. A revisão demora até 48 horas.

[Ver os meus anúncios]({account_listings_url})`,
  },
  {
    key: "listing_edited",
    description: "Anúncio editado: alterações em revisão",
    subject: "Alterações ao anúncio \"{listing_title}\" em revisão",
    heading: "Alterações em revisão",
    body: `Olá {name},

Recebemos as alterações ao anúncio "{listing_title}". Ficam visíveis depois de revistas, normalmente em menos de 48 horas.`,
  },
  {
    key: "listing_published",
    description: "Anúncio aprovado e publicado",
    subject: "O seu anúncio \"{listing_title}\" está publicado",
    heading: "Anúncio publicado",
    body: `Olá {name},

O seu anúncio "{listing_title}" está publicado e visível para todos.

[Ver anúncio]({listing_url})

Fica ativo até {expires_at}. Avisamos antes de expirar.`,
  },
  {
    key: "listing_rejected",
    description: "Anúncio rejeitado, com motivo",
    subject: "O seu anúncio \"{listing_title}\" precisa de alterações",
    heading: "Anúncio não publicado",
    body: `Olá {name},

Revimos o anúncio "{listing_title}" e não o podemos publicar como está.

Motivo: {reason}

Corrija o anúncio e volte a enviá-lo para revisão.

[Editar anúncio]({edit_url})`,
  },
  {
    key: "listing_expiring",
    description: "Anúncio a expirar (dias antes)",
    subject: "O anúncio \"{listing_title}\" expira a {expires_at}",
    heading: "O seu anúncio vai expirar",
    body: `Olá {name},

O anúncio "{listing_title}" expira a {expires_at}. Renove-o para continuar visível mais {duration_days} dias.

[Renovar anúncio]({renew_url})`,
  },
  {
    key: "listing_expired",
    description: "Anúncio expirado",
    subject: "O anúncio \"{listing_title}\" expirou",
    heading: "Anúncio expirado",
    body: `Olá {name},

O anúncio "{listing_title}" na categoria {category_name} expirou a {expires_at} e deixou de estar visível.

[Renovar anúncio]({renew_url})`,
  },
  {
    key: "listing_renewal_reminder",
    description: "Lembrete depois de expirar",
    subject: "Ainda quer passar o seu negócio?",
    heading: "Lembrete: anúncio expirado",
    body: `Olá {name},

O anúncio "{listing_title}" expirou a {expires_at}. Se o negócio ainda está disponível, renove o anúncio com um clique.

[Renovar anúncio]({renew_url})`,
  },
  {
    key: "listing_contact",
    description: "Contacto de interessado para o anunciante",
    subject: "Novo contacto sobre \"{listing_title}\"",
    heading: "Tem um interessado",
    body: `Olá {name},

Recebeu uma mensagem sobre o anúncio "{listing_title}".

Nome: {sender_name}
Email: {sender_email}
Telefone: {sender_phone}

{message}

Responda a este email para falar diretamente com {sender_name}.

[Ver anúncio]({listing_url})`,
  },
  {
    key: "site_contact_ack",
    description: "Formulário de contactos: confirmação ao visitante",
    subject: "Recebemos a sua mensagem",
    heading: "Obrigado pelo contacto",
    body: `Olá {name},

Recebemos a sua mensagem e respondemos por email assim que possível.`,
  },
  {
    key: "account_deleted",
    description: "Conta apagada",
    subject: "A sua conta foi apagada",
    heading: "Conta apagada",
    body: `Olá {name},

A sua conta e os seus anúncios foram apagados do Portal do Trespasse, como pediu. Obrigado por ter usado o portal.`,
  },
  {
    key: "migration_notice",
    description: "Mudança de site (opcional, só no dia da migração)",
    subject: "O Portal do Trespasse tem um site novo",
    heading: "Site novo, a mesma conta",
    body: `Olá {name},

O Portal do Trespasse mudou para um site novo, mais rápido e simples de usar. A sua conta e os seus anúncios passaram para o site novo e a sua password continua a mesma.

Se não se lembrar da password, pode pedir uma nova em {reset_request_url}

[Entrar]({login_url})`,
  },
  {
    key: "admin_new_user",
    description: "Administração: novo registo",
    subject: "[Admin] Novo registo: {user_name}",
    heading: "Novo registo",
    body: `{user_name} ({user_email}) criou conta.

[Ver utilizador]({admin_user_url})`,
  },
  {
    key: "admin_listing_pending",
    description: "Administração: anúncio por aprovar",
    subject: "[Admin] Anúncio por aprovar: {listing_title}",
    heading: "Anúncio por aprovar",
    body: `{user_name} {action} o anúncio "{listing_title}".

[Rever anúncio]({admin_listing_url})`,
  },
  {
    key: "admin_listing_expired",
    description: "Administração: anúncio expirado",
    subject: "[Admin] Anúncio expirado: {listing_title}",
    heading: "Anúncio expirado",
    body: `O anúncio "{listing_title}" de {user_name} expirou.

[Ver anúncio]({admin_listing_url})`,
  },
  {
    key: "admin_report",
    description: "Administração: nova denúncia",
    subject: "[Admin] Denúncia: {listing_title}",
    heading: "Nova denúncia",
    body: `Foi denunciado o anúncio "{listing_title}".

Motivo: {reason}

[Ver denúncias]({admin_reports_url})`,
  },
  {
    key: "admin_site_contact",
    description: "Administração: mensagem do formulário de contactos",
    subject: "[Contacto] {sender_name}",
    heading: "Nova mensagem de contacto",
    body: `Nome: {sender_name}
Email: {sender_email}

{message}`,
  },
];
