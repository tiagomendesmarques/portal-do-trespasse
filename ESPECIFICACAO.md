# Portal do Trespasse: especificação do novo site

Documento de referência para substituir o WordPress em `portaldotrespasse.pt` por uma aplicação própria.
Baseado na análise do site atual feita a 27/10/2026 (HTML público, sitemaps do Yoast, REST API do WordPress e endpoints AJAX públicos do plugin).

- Protótipo navegável: https://claude.ai/artifact/HEN19MLfkHJqp8bwn1xGHC (cópia local em `prototipo/portal-do-trespasse.html`)
- Dados recolhidos: pasta `data/`

---

## 1. O que o site é

Classificados de negócios em Portugal: trespasses, venda de empresas/ativos, aluguer de ativos e procura de investimento.

- Publicar é **gratuito**. O objetivo atual é captar anunciantes.
- O visitante pesquisa sem conta. Para publicar é obrigatório criar conta.
- Os anúncios são moderados (proposta: ficam "pendentes" até aprovação de um administrador; confirmar se hoje é assim no wp-admin).
- O blog (336 artigos, 2 por dia entre dez/2024 e jan/2026) é a principal fonte de tráfego orgânico.

Números em 27/10/2026: 17 anúncios ativos · 13 categorias · 18 distritos / 277 concelhos · 336 artigos · 21 páginas.

## 2. Stack atual (a substituir)

| Peça | O quê |
|---|---|
| CMS | WordPress 7.0 |
| Tema | Classima + `classima-child` (RadiusTheme) |
| Classificados | Classified Listing 5.5 + Classified Listing Pro 4.1 (post type `rtcl_listing`, taxonomias `rtcl_category`, `rtcl_location`) |
| Páginas | Elementor + Elementor Pro, Essential Addons |
| Outros | Yoast SEO, Wordfence, Autoptimize, Nextend Social Login (sem botões visíveis), Contact Form 7, Google Tag Manager `GTM-T6S7GRGN`, Cloudflare |
| Cores | `#89d3cd` (verde-água, primária) e `#000333` (azul-marinho) |
| Logótipo | `/wp-content/uploads/2023/06/LogoBlackSmall.png`, favicon `cropped-logo512` |

## 3. Mapa do site e URLs

**Manter os mesmos URLs** para não perder SEO. Só mudam os que estão partidos (com 301).

| URL atual | Página | Novo site |
|---|---|---|
| `/` | Início | igual |
| `/all-ads/` (+ `?q=`, filtros, `orderby=`) | Todos os anúncios | igual |
| `/listing/{slug}/` | Anúncio | igual |
| `/listing-category/{slug}/` | Categoria | igual; `tecnologia` → 301 para `imobiliario` |
| `/listing-location/{distrito}/` e `/{distrito}/{concelho}/` | Localização | igual (os slugs de concelho atuais incluem `cidade-lisboa`, `cidade-porto`, etc.; manter) |
| `/post-an-ad/` | Publicar anúncio | igual |
| `/my-account/` (+ `/lost-password/` e subpáginas do plugin) | Login, registo, conta | igual |
| `/blog/` | Blog | igual |
| `/{slug}/` | Artigo do blog (336) | igual |
| `/faq-2/` | FAQ real | servir em `/faq/` e 301 de `/faq-2/` |
| `/como-vender-o-seu-negocio/`, `/o-nosso-programa-de-ajuda/`, `/promove-o-teu-anuncio/`, `/como-manter-me-seguro/`, `/termos-e-condicoes/`, `/politica-de-privacidade/`, `/contact/` | Páginas | igual |
| `/about-us/`, `/faq/` (demo), `/stores/`, `/store/*`, `/shop/`, `/cart/`, `/checkout/`, `/checkout-2/`, `/compare/`, `/my-account-2/` | Lixo do tema (lorem ipsum, lojas fictícias, WooCommerce) | 301 para `/` ou página nova "Sobre nós" |
| `/author/{user}/` | Arquivo de autor | 301 para `/all-ads/` |
| `/feed/`, `/comments/feed/` | RSS | manter `/feed/` do blog |

Lista completa dos 415 URLs indexados em `data/urls_atuais.txt`.

Menu: Anúncios · Programa de ajuda · Blog · (FAQ) · Entrar/Minha conta · botão **Publicar anúncio**.
Rodapé: texto institucional; "Ajuda no trespasse" (Como vender, Programa de ajuda, Promove o teu anúncio); "Informação" (Blog, Sitemap, Termos); "Suporte" (FAQ, Como manter-me seguro, Contactos); © Portal do Trespasse.

## 4. Taxonomias

### Tipos de anúncio (obrigatório, escolhido antes da categoria)
| Chave | Nome |
|---|---|
| `trespasse` | Trespasse |
| `venda_de_ativos` | Venda de Ativos |
| `aluguer_de_ativos` | Aluguer de Ativos |
| `investimentos` | Investimentos |

### Categorias (13, sem subcategorias): `data/categorias.json`
Agricultura · Construção Civil · Educação · Energia · Finanças e Seguros · Imobiliário · Indústria Alimentar · Logística · Media · Restauração · Saúde · Serviços/Setores Diversos · Turismo e Hotelaria.
Cada uma tem ícone. Suportar hierarquia (pai/filho) no modelo, mesmo que hoje não se use.

### Localizações: `data/localizacoes.json`
Distrito → Concelho. Hoje só existem os 18 distritos do continente, com 277 concelhos: **falta Ourém** (distrito de Santarém, que tem 21).
**Acrescentar** Ourém, a Região Autónoma dos Açores (19 concelhos) e a Região Autónoma da Madeira (11 concelhos), num total de 308.

## 5. Modelo do anúncio

> Tudo nesta secção foi confirmado na base de dados (dump de 27/10/2026): definições do plugin (`wp_options` → `rtcl_moderation_settings`, `rtcl_general_settings`, `rtcl_misc_settings`, `rtcl_account_settings`) e campos personalizados (`rtcl_cf`). Definições exatas em `data/campos_personalizados.json`.

### Campos base do formulário
| Campo | Regra |
|---|---|
| Tipo de anúncio | obrigatório, um dos 4 (`trespasse`, `venda_de_ativos`, `aluguer_de_ativos`, `investimentos`) |
| Categoria | obrigatória, uma das 13 |
| Título | obrigatório, máx. **45** caracteres |
| Descrição | obrigatória, máx. **2000** caracteres, editor rico (`wp_editor`) |
| Tipo de preço | `fixed` Fixo (8 anúncios) · `negotiable` Negociável (14) |
| Preço | € inteiro, separador de milhares `.`, decimal `,`, símbolo à direita com espaço (`95.000 €`) |
| Unidade de preço | `total` "preço total" · `month` "por mês" · vazio |
| Características | lista de texto, uma por linha (meta `classima_spec_info`) |
| Fotografias | **máx. 9 por anúncio**, **máx. 3 MB** cada, png/jpg/jpeg/webp, não obrigatórias, ordenáveis |
| Localização | obrigatória: Distrito → Concelho (o plugin chama-lhes "Distrito" e "Cidade") |
| Telefone | **obrigatório**; revelado com clique, e só a utilizadores com sessão iniciada |
| Escondidos no formulário atual | vídeo, código postal, morada, WhatsApp, email, website (`hide_form_fields`). Não os mostrar no site novo; manter só no modelo de dados. |
| Horário comercial e perfis sociais | **desligados** (3 anúncios antigos têm horário; mostrar se existir, sem campo no formulário) |
| Mapa | desligado |
| Termos | sem checkbox de termos no formulário de anúncio hoje (`enable_listing_terms_conditions: no`) |

### Regras de funcionamento
| Regra | Valor atual |
|---|---|
| Estado de um anúncio novo | **pendente** (moderação manual) |
| Estado após edição | **pendente** |
| Validade | **120 dias** após publicação; renovação permitida |
| Anúncios expirados | apagados ao fim de 365 dias |
| Etiqueta "Novo" | primeiros 15 dias · "Popular" a partir de 100 visitas · "Destaque" e "Top" existem mas não há planos ativos |
| Anúncios por página | 9, vista em grelha por omissão; 4 relacionados |
| Favoritos, denunciar abuso, marcar como vendido, comparar, vista rápida | ligados |
| Avaliações (Quality/Price/Service) | ligadas (proposta: retirar) |
| Informação do vendedor | só para utilizadores com sessão iniciada |
| Chat interno | desligado |
| Registo | ligado, **verificação de email obrigatória**, telefone opcional |
| Publicar sem conta | não |
| Plano | "Grátis": 0 €, 10 anúncios. Os planos pagos (Top, Destaque, Bump up de 10 a 25 €) estão em rascunho. Stripe, Authorize.net e transferência desligados. Nunca houve pagamentos reais (os 11 registos são de demonstração ou do plano grátis). |

### Campos personalizados (secção "Visão geral")
12 campos, grupo "General Custom Fields", associados a **todas as categorias**. Ordem do site:

| # | ID | Rótulo | Tipo | Opções (valor guardado) | Obrigatório | Pesquisável | Ajuda / placeholder |
|---|---|---|---|---|---|---|---|
| 0 | 2686 | Renda | número | | não | sim | "Valor da Renda (Mensal)" · Ex: 1200 |
| 1 | 3170 | Faturação média anual | número | | não | sim | "Em média quanto fatura anualmente? Indique um valor aproximado. Complete este campo para uma venda mais rápida." |
| 2 | 2696 | Venda urgente? | checkbox | `sim` Sim | não | não | |
| 3 | 2688 | IVA | rádio | `plus-iva` +IVA · `inclui-iva` Inclui IVA | não | não | "O valor do trespasse apresentado é +IVA ou já contém o IVA?" |
| 4 | 2692 | O trespasse inclui trabalhadores com contrato? | rádio | `sim` · `nao` | não | sim | |
| 5 | 2693 | Quantos trabalhadores com contrato sem termo? | número | | não | não | Ex: 3 · **só se #4 = sim** |
| 6 | 2695 | Quantos trabalhadores com contrato com termo? | número | | não | não | Ex: 9 · **só se #4 = sim** |
| 7 | 2694 | Há quanto tempo no mercado? (anos) | número, mín. 1 | | não | sim | "A empresa tem quantos anos no mercado de trabalho?" · Ex: 10 anos |
| 8 | 2698 | Negócio sazonal | rádio | `sim` · `nao` | **sim** | não | |
| 9 | 2699 | Tipo de negócio | checkbox | `b2b` B2B (Empresas) · `b2c` B2C (Pessoas Singulares) | **sim** | não | "Vende os seus produtos e serviços a empresas ou consumidores finais? Ou a ambos os casos." |
| 10 | 2989 | Depende de fornecedores? | rádio | `sim` · `nao` | **sim** | não | "Por exemplo: um restaurante depende de fornecedores de carne, peixe, etc" |
| 11 | 2701 | Presença | checkbox | `espaco-fisico` Espaço Físico · `online` Online | **sim** | não | "O seu negócio tem uma vertente online? Ou é apenas físico?" |

Os valores estão em `wp_postmeta` com a chave `_field_{ID}`. Corrigir na migração: rótulo "Tipo de negócio." (ponto final) e "Faturação média Anual".

Os campos devem ser **configuráveis no back-office** (rótulo, tipo, opções, obrigatório, ordem, condição, ajuda, placeholder, a que categorias/tipos se aplicam, se são filtro).

**Lixo a não migrar:** 71 outros `rtcl_cf` (marcas de carros, portáteis, animais…) e o "Sample Form" do Form Builder (`wp_rtcl_forms`) são restos da demonstração do tema e não estão em uso.

## 6. Páginas e comportamento

### Início
- Hero com pesquisa: texto livre ("O que procura?"), localização, categoria, botão Procurar.
- Grelha de categorias com número de anúncios.
- **Novo:** anúncios recentes.
- Últimos 3 artigos do blog.
- CTA "Publicar anúncio grátis".

### Listagem (`/all-ads/`, categoria, localização, pesquisa)
- Filtros: pesquisa, Tipo (rádio), Categoria, Localização (distrito → concelho), Faixa de preço (mín./máx.). Os campos personalizados podem passar a filtros (configurável).
- Ordenação: A a Z, Z a A, mais recentes, mais antigos, mais vistos, menos vistos, preço ↑, preço ↓.
- "A mostrar 1–10 de N resultados", paginação, vista lista/grelha.
- Cartão: foto principal, categoria, título, há quanto tempo, nome público do anunciante, "Concelho, Distrito", excerto, tipo, visualizações, preço + unidade, "Detalhes", favorito.

### Anúncio
- Breadcrumb, galeria com zoom/lightbox, título, tipo, local, data, visualizações, referência.
- **Novo:** preço e tipo de preço em destaque (hoje só aparece na listagem).
- Visão geral (campos personalizados), descrição, características (lista com visto), horário comercial.
- Lateral: anunciante (nome público, online/offline), revelar telefone (regista clique), WhatsApp, "Enviar mensagem" (nome, email, telefone, mensagem → email ao anunciante e cópia na caixa de mensagens), favoritos (exige login), partilhar, denunciar abuso (texto → fila do back-office).
- Dicas de segurança. Anúncios semelhantes.
- JSON-LD (`Product`/`Offer` ou `Place`) e Open Graph.
- **Retirar:** o formulário de avaliações "Quality/Price/Service".

### Conta
- Login: email ou nome de utilizador, password, "Lembrar-se de mim", "Esqueceu-se da sua password?".
- Registo: telefone (opcional), nome de utilizador (não pode ser alterado), email, password (mín. 6), confirmação, aceitação da política de privacidade.
- **Novo:** login com Google (o plugin Nextend já está instalado, mas sem botões); verificação de email.
- Painel: resumo (anúncios, publicados, visualizações, favoritos).
- Os meus anúncios: estado, preço, visitas, datas, editar, marcar como vendido, renovar, apagar.
- Favoritos.
- **Novo:** Mensagens (histórico de contactos recebidos e enviados).
- Editar conta: nome público, nome, apelido, email, telefone, WhatsApp, website, localização, foto. Apagar conta (RGPD).
- Alterar password.

### Publicar anúncio (exige login; senão "Desculpe, precisa de fazer login primeiro." e volta depois do login)
1. Tipo de anúncio.
2. Categoria.
3. Formulário: informação (título, preço, descrição), detalhes do negócio (campos personalizados), características, fotografias e vídeo, localização, contacto (pré-preenchido do perfil), horário, aceitar termos.
- Contadores de caracteres, validação com as mensagens do site atual ("Este campo é obrigatório.", "Por favor insira um endereço de e-mail válido.", "Insira no máximo {0} caracteres.", "O tamanho da imagem é maior que 2 MB.", "Extensão de arquivo não suportada.", "O limite de imagens acabou.").
- Guardar rascunho automático.
- Ao enviar: estado pendente, email ao anunciante e aos administradores. Editar um anúncio publicado volta a pô-lo em revisão (configurável).

### Back-office (`/admin`, só administradores e editores)
Substitui o wp-admin por completo. O dono não deve precisar de mais nenhuma ferramenta para gerir o site.

- **Painel:** anúncios por aprovar, publicados, a expirar nos próximos 7 dias, novos registos, denúncias abertas, visitas e contactos dos últimos 30 dias.
- **Moderação:** fila de anúncios novos e editados; pré-visualizar como o público os vê; aprovar ou rejeitar com motivo (texto livre ou motivos pré-definidos), que segue por email ao anunciante. Ver o que mudou numa edição.
- **Anúncios:** pesquisa e filtros (estado, categoria, tipo, distrito, anunciante, datas); editar qualquer campo e as fotos; despublicar, marcar como vendido, prolongar validade, destacar, apagar; ações em massa (renovar, apagar).
- **Utilizadores:** pesquisa; ver perfil, anúncios e histórico; mudar perfil (anunciante, editor, administrador); bloquear/desbloquear; reenviar verificação; enviar ligação de reposição de password; apagar (com os anúncios); entrar como o utilizador para dar suporte (com registo de auditoria).
- **Denúncias:** fila com o anúncio, o motivo e quem denunciou; resolver, despublicar o anúncio ou bloquear o anunciante.
- **Mensagens:** formulário de contactos do site e contactos aos anunciantes (para detetar abuso).
- **Conteúdos:** categorias (nome, slug, ícone, ordem), localizações, tipos de anúncio, campos personalizados (secção 5), blog e páginas (editor rico, imagem de destaque, SEO: título, descrição, slug, canonical), FAQ.
- **Emails:** editar assunto e texto de cada modelo (secção seguinte) com variáveis; enviar email de teste; registo dos emails enviados com estado (enviado, falhado, devolvido).
- **Redirects:** lista de 301 (origem → destino) com contador de acessos.
- **Definições:** moderação ligada/desligada, validade dos anúncios (120 dias), dias de aviso antes de expirar (3), apagar expirados ao fim de N dias (365), máx. fotos (9) e tamanho (3 MB), limites de caracteres, anúncios grátis por utilizador, email e nome do remetente, emails do administrador que recebem avisos, textos da faixa de anúncio/manutenção.
- **Planos pagos (destaque, top, bump up):** modelo preparado, **desligado**.
- **Auditoria:** quem aprovou, rejeitou, editou ou apagou o quê, e quando.

### Páginas institucionais
FAQ (10 perguntas da `/faq-2/`), Como vender, Programa de ajuda, Promove o teu anúncio, Como manter-me seguro, Termos, Privacidade, Contactos (nome, email, mensagem). Texto atual no protótipo e em `prototipo/portal-do-trespasse.html`. Página "Sobre nós" a escrever.

### Emails transacionais
Hoje o WordPress envia estes emails com assunto em português mas **texto em inglês** ("Dear {name}, Your submission…"). No site novo ficam todos em português de Portugal, em HTML simples com a marca, editáveis no back-office.

| Evento | Para o utilizador | Para o administrador | Notas |
|---|---|---|---|
| Registo | Confirme o seu email (ligação válida 48 h) | Novo registo | Sem verificação não pode publicar. Reenvio limitado a 3. |
| Email confirmado | Bem-vindo, como publicar o primeiro anúncio | | |
| Recuperar password | Ligação para nova password (válida 1 h) | | |
| Password ou email alterados | Aviso de segurança | | |
| Anúncio enviado | "Recebemos o seu anúncio, a revisão demora até 48 h" | Novo anúncio por aprovar (com ligação direta) | |
| Anúncio editado | "Alterações em revisão" | Anúncio editado por aprovar | |
| Anúncio aprovado | "O seu anúncio está publicado" + ligação | | |
| Anúncio rejeitado | Motivo e como corrigir | | Novo, não existe hoje |
| A expirar | 3 dias antes, com botão Renovar | | |
| Expirado | Expirou + botão Renovar | Anúncio expirado | |
| Lembrete de renovação | 3 dias depois de expirar | | |
| Contacto de interessado | Nome, email, telefone e mensagem do interessado (responder vai direto para ele) | Cópia opcional | Responder-para = email do interessado |
| Denúncia | | Nova denúncia | |
| Formulário de contactos | Confirmação de receção | Nova mensagem | |
| Conta apagada | Confirmação | | RGPD |
| Utilizador migrado (opcional) | "O Portal do Trespasse mudou": a password mantém-se | | Enviar só no dia da mudança, se o dono quiser |

Regras:
- Remetente "Portal do Trespasse" em `@portaldotrespasse.pt`, com SPF, DKIM e DMARC configurados.
- Os emails para administradores vão para uma lista configurável (hoje: o email de administrador do WordPress e mais um).
- **Staging: nenhum email sai.** Ficam só no registo do back-office, com pré-visualização.
- Os envios passam por uma fila com novas tentativas; os falhados aparecem no back-office.
- Ligação para cancelar avisos não essenciais (lembretes) no perfil.

## 7. Problemas encontrados no site atual

1. Categoria "Imobiliário" com slug `tecnologia`.
2. Utilizadores com o email como nome público, que aparece nos cartões (protegido pelo Cloudflare, mas ainda assim exposto). Separar nome público de login.
3. `/contact/` mostra `[contact-form-7 id="339" title="Contact"]` em texto.
4. Preço não aparece na página do anúncio; anunciantes põem o preço no título.
5. Faltam Açores, Madeira e o concelho de Ourém.
6. Conteúdo demo do tema publicado: `/about-us/`, `/faq/`, 6 lojas, `/shop/`, `/cart/`, `/compare/`, tags "Computer", "Food", "Mobile", etc.
7. Avaliações "Quality/Price/Service" em inglês.
8. Gralhas: "Ajuda no trepasse", ponto 6 de "Como vender" duplica o 5, rótulos "Tipo de negócio." e "Faturação média Anual", "Leave feedback about this".
9. Artigos do blog com anos desatualizados no título ("em 2023", "em 2024") apesar de datados de 2026.
10. `robots.txt` bloqueia GPTBot, ClaudeBot, Bytespider, Amazonbot: decidir se se mantém.

## 8. Migração

Fonte preferida: **dump da base de dados MySQL** do WordPress + pasta `wp-content/uploads`. A REST API pública (`/wp-json/wp/v2/rtcl_listing`, `/wp-json/wp/v2/posts`, `/wp-json/wp/v2/media`) serve de alternativa, mas não expõe os metadados (preço, campos personalizados, contactos, horário), que estão em `wp_postmeta`. A REST do plugin (`/wp-json/rtcl/v1`) exige chave.

- Anúncios: `wp_posts` (`post_type = 'rtcl_listing'`) + `wp_postmeta` (preço, `_rtcl_*`, campos personalizados `_field_{id}`, galeria) + `wp_term_relationships` (categoria, localização) + tipo de anúncio. Snapshot público já recolhido em `data/anuncios.json`.
- Imagens: export completo de `wp-content/uploads` recebido a 27/10/2026 (13 ZIPs, 5563 ficheiros, 339 MB; guardado fora do Git). Confirmado contra a base de dados: as **89 fotos dos anúncios** (até 9 por anúncio), as **336 imagens destacadas** do blog e as 28 imagens no texto de 2 artigos/páginas estão todas presentes. Migrar só estas (o resto são tamanhos gerados, demo do tema e WebP de otimização), gerar os tamanhos novos e reescrever os URLs no texto. Os 17 `.php` na pasta são stubs do Redux sem código suspeito e não migram.
- Utilizadores: `wp_users` + `wp_usermeta` (telefone em `_rtcl_phone`, WhatsApp `_rtcl_whatsapp_number`, website `_rtcl_website`, morada `_rtcl_address`, código postal `_rtcl_zipcode`, localização `_rtcl_location`; perfil em `wp_capabilities`). Guardar `wp_user_id` para ligar anúncios (`post_author`).
  - **Passwords:** 914 contas com `$wp$2y$…` (WP ≥ 6.8: bcrypt sobre base64(HMAC-SHA384(password, chave "wp-sha384"))) e 9 com phpass `$P$…`. Verificar os dois formatos no 1.º login e voltar a gerar o hash no formato novo. Não há contas com MD5 nem login social (`wp_social_users` vazio).
  - **Contas reais vs. spam:** 923 contas, mas **860 nunca verificaram o email** (têm `rtcl_verification_key`) e 848 foram criadas em julho–agosto de 2026 (vaga de registos automáticos). Só **63 estão verificadas**, e incluem os 17 anunciantes e as 4 contas da equipa (2 administradores, 1 editor, 1 autor). **Decisão (27/10/2026): migrar só as 63 verificadas**; as não verificadas ficam de fora (nunca puderam publicar).
  - 27 contas usam o email como nome de utilizador e nome público: gerar nome público a partir do primeiro nome ou de "Anunciante".
- Anúncios: 17 publicados + 5 expirados (`rtcl-expired`, migrar como expirados). Tipo em `ad_type`, preço em `price`, `price_type`, `_rtcl_price_unit`, telefone `phone`, características `classima_spec_info`, ordem das fotos `_rtcl_attachments_order`, visitas `_views`, validade `expiry_date`, horário `_rtcl_bhs`. **9 anúncios expiram a 4/11/2026.**
- Estatísticas: `wp_rtcl_listing_stats` (666 linhas) com visitas e cliques; migrar como contadores.
- Não migrar: 436 comentários (todos spam, por aprovar), `wp_rtcl_sessions`, tabelas do Wordfence, Action Scheduler e Yoast indexables (regeneráveis). As 58 mensagens do formulário de contacto (`wp_e_submissions`) podem ser exportadas à parte se interessarem.
- Blog: 336 artigos com slug, data, conteúdo, imagem de destaque, etiquetas, metadados Yoast (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`). Índice em `data/blog_artigos.json`.
- Páginas: texto reescrito à mão (Elementor guarda JSON).
- Favoritos, contagens de visitas: migrar se existirem em `wp_usermeta`/`wp_postmeta`.
- Redirects: tabela gerada a partir de `data/urls_atuais.txt`.
- Validar no fim: todos os 415 URLs respondem 200 ou 301.
- **Estado (27/10/2026):** importação ensaiada numa base vazia e confirmada por `scripts/wp-verify.ts` (20/20), idempotente, 415/415 URLs. Também migram os 2 rascunhos do blog, as 58 mensagens de contacto (sem IP) e os cliques no telefone de `wp_rtcl_listing_stats`. Guia do dia da mudança: `docs/MIGRACAO.md`.

## 9. Requisitos não funcionais

- Português de Portugal em toda a interface; números `95.000 €`; datas `27 de outubro de 2026`.
- SSR para SEO; `sitemap.xml` (anúncios, categorias, localizações, artigos, páginas); `robots.txt`; canonical; Open Graph; JSON-LD.
- Pesquisa em PostgreSQL com `unaccent` e dicionário português (café = cafe).
- Imagens redimensionadas (miniatura, média, grande) e servidas em WebP.
- RGPD: aviso de cookies com consentimento antes do GTM; exportar e apagar dados do utilizador.
- Anti-spam: rate limit em login, registo, contacto e denúncias; Turnstile ou reCAPTCHA no registo e contacto.
- Acessibilidade AA, mobile-first.
- Deploy em Google Cloud Run (container único), Cloud SQL Postgres, Cloud Storage para imagens, segredos no Secret Manager.
