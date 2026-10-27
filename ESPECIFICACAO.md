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

### Campos base
| Campo | Regra | Estado da análise |
|---|---|---|
| Tipo de anúncio | um dos 4 | confirmado |
| Categoria | uma das 13 | confirmado |
| Título | obrigatório, máx. **45** caracteres | confirmado (config. JS do plugin) |
| Descrição | obrigatória, máx. **2000** caracteres, texto rico simples (parágrafos, negrito, listas) | confirmado |
| Tipo de preço | `fixed` Fixo · `negotiable` Negociável · `on_call` Sob consulta | os 2 primeiros vistos nos cartões; o 3.º é o padrão do plugin |
| Preço | inteiro em €, obrigatório salvo "Sob consulta" | confirmado |
| Unidade de preço | `total` "preço total" · `month` "por mês" · vazio | confirmado |
| Características | lista de texto, uma por linha | confirmado |
| Fotografias | JPG/PNG, **máx. 2 MB** cada, ordenáveis, a 1.ª é a principal | confirmado; limite por anúncio a confirmar (vimos até 9) |
| Vídeo | URL YouTube/Vimeo | provável (tema) |
| Distrito, Concelho | obrigatórios | confirmado |
| Código postal, morada | opcionais | provável |
| Telefone, WhatsApp, email, website | contactos do anúncio | provável; telefone e WhatsApp têm tracking de cliques no JS |
| Horário comercial | por dia: horário (abre/fecha), 24 h ou fechado; opcional | confirmado |
| Mapa (lat/lng) | desligado hoje | confirmado |
| Estado | `pendente`, `publicado`, `rejeitado`, `expirado`, `vendido` | proposta |
| Visualizações | contador | confirmado |
| Datas | criação, publicação, expiração | proposta (validade a confirmar no wp-admin) |
| Destaque | `featured`, `top`, `urgent` (badges do plugin) | desligado; preparar no modelo |

### Campos personalizados (secção "Visão geral")
Observados nos 17 anúncios publicados. Hoje aplicam-se a todas as categorias. Todos opcionais.

| Rótulo no site | Tipo | Opções / notas |
|---|---|---|
| Renda | número (€/mês) | |
| IVA | escolha única | `+IVA`, `Inclui IVA` |
| Faturação média anual | número (€) | |
| O trespasse inclui trabalhadores com contrato? | escolha única | Sim / Não |
| Quantos trabalhadores com contrato com termo? | número | só se a anterior = Sim |
| Quantos trabalhadores com contrato sem termo? | número | só se a anterior = Sim |
| Há quanto tempo no mercado? (anos) | número | |
| Negócio sazonal | escolha única | Sim / Não |
| Tipo de negócio | escolha múltipla | B2B (Empresas), B2C (Pessoas Singulares) |
| Depende de fornecedores? | escolha única | Sim / Não |
| Presença | escolha múltipla | Espaço Físico, Online |
| Venda urgente? | escolha única | Sim / Não |

Os campos devem ser **configuráveis no back-office** (rótulo, tipo, opções, obrigatório, ordem, condição, a que categorias/tipos se aplicam, se aparecem como filtro).

> O formulário de publicação só aparece com sessão iniciada, por isso não foi visto diretamente. Antes de fechar o desenvolvimento, confirmar a lista de campos com uma conta de teste ou no wp-admin (Classified Listing → Custom Fields / Form Builder e Settings).

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

### Back-office (`/admin`, só administradores)
- Moderação: aprovar/rejeitar (com motivo enviado por email).
- Anúncios: pesquisar, editar, despublicar, destacar, apagar.
- Utilizadores: listar, bloquear, mudar perfil, apagar.
- Denúncias e mensagens de contacto.
- Categorias, localizações, tipos de anúncio, campos personalizados.
- Blog e páginas (editor simples com SEO: título, descrição, slug, imagem).
- Redirects.
- Definições: validade dos anúncios, moderação ligada/desligada, limite de fotos, emails.
- Planos pagos (destaque): modelo preparado, **desligado**.

### Páginas institucionais
FAQ (10 perguntas da `/faq-2/`), Como vender, Programa de ajuda, Promove o teu anúncio, Como manter-me seguro, Termos, Privacidade, Contactos (nome, email, mensagem). Texto atual no protótipo e em `prototipo/portal-do-trespasse.html`. Página "Sobre nós" a escrever.

### Emails transacionais
Boas-vindas/verificação, recuperação de password, anúncio recebido, aprovado, rejeitado, a expirar, expirado, nova mensagem de interessado, nova denúncia (admin), novo anúncio por aprovar (admin), contacto do site (admin).

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
- Imagens: `wp-content/uploads/classified-listing/{ano}/{mês}/` → bucket.
- Utilizadores: `wp_users` + `wp_usermeta`. Migrar os hashes de password (`$wp$2y$...` bcrypt no WP ≥ 6.8, ou phpass `$P$`), validar no 1.º login e voltar a gerar o hash. Alternativa: obrigar a redefinir a password.
- Blog: 336 artigos com slug, data, conteúdo, imagem de destaque, etiquetas, metadados Yoast (`_yoast_wpseo_title`, `_yoast_wpseo_metadesc`). Índice em `data/blog_artigos.json`.
- Páginas: texto reescrito à mão (Elementor guarda JSON).
- Favoritos, contagens de visitas: migrar se existirem em `wp_usermeta`/`wp_postmeta`.
- Redirects: tabela gerada a partir de `data/urls_atuais.txt`.
- Validar no fim: todos os 415 URLs respondem 200 ou 301.

## 9. Requisitos não funcionais

- Português de Portugal em toda a interface; números `95.000 €`; datas `27 de outubro de 2026`.
- SSR para SEO; `sitemap.xml` (anúncios, categorias, localizações, artigos, páginas); `robots.txt`; canonical; Open Graph; JSON-LD.
- Pesquisa em PostgreSQL com `unaccent` e dicionário português (café = cafe).
- Imagens redimensionadas (miniatura, média, grande) e servidas em WebP.
- RGPD: aviso de cookies com consentimento antes do GTM; exportar e apagar dados do utilizador.
- Anti-spam: rate limit em login, registo, contacto e denúncias; Turnstile ou reCAPTCHA no registo e contacto.
- Acessibilidade AA, mobile-first.
- Deploy em Google Cloud Run (container único), Cloud SQL Postgres, Cloud Storage para imagens, segredos no Secret Manager.
