# Prompt para o Claude Code

Copia o bloco abaixo para o Claude Code, num repositório novo que tenha esta pasta (`ESPECIFICACAO.md`, `data/`, `prototipo/`).

---

```
Vamos substituir o site WordPress portaldotrespasse.pt por uma aplicação nossa, para correr no Google Cloud Run.

Lê primeiro, por esta ordem:
1. ESPECIFICACAO.md: o que o site faz, os campos, as páginas, os URLs a manter, os problemas a corrigir e a migração.
2. prototipo/portal-do-trespasse.html: protótipo navegável com o comportamento e os textos esperados. Abre-o num browser. É uma referência de fluxo e conteúdo, não de código; não copies o JavaScript dele.
3. data/: categorias, localizações, os 17 anúncios atuais, o índice dos 336 artigos do blog e os 415 URLs indexados.

Stack:
- Next.js (App Router) com TypeScript e renderização no servidor para todas as páginas públicas.
- PostgreSQL (Cloud SQL) com Drizzle ORM e migrações versionadas. Pesquisa com tsvector, dicionário português e unaccent.
- Autenticação por email e password (bcrypt), sessões em cookie httpOnly, recuperação de password e verificação de email. Login com Google preparado mas desligado por variável de ambiente.
- Imagens no Google Cloud Storage, redimensionadas com sharp para WebP (miniatura 400px, média 800px, grande 1600px).
- Emails transacionais por um fornecedor configurável (começar com Resend), com templates em português.
- Tailwind CSS. Cores da marca: #89d3cd e #000333. Tudo em português de Portugal.
- Um único Dockerfile (output standalone), porta via $PORT, sem estado em disco. Healthcheck em /api/health.

Regras do domínio:
- Mantém os URLs atuais (/all-ads/, /listing/{slug}/, /listing-category/{slug}/, /listing-location/{distrito}/{concelho}/, /post-an-ad/, /my-account/, /blog/, /{slug-do-artigo}/ e as páginas). Os redirects 301 da secção 3 da especificação ficam numa tabela gerível no back-office.
- Fluxo de publicação em 3 passos: tipo de anúncio → categoria → formulário. Título até 45 caracteres, descrição até 2000, fotos JPG/PNG até 2 MB cada.
- Os campos personalizados ("Visão geral") são dados, não colunas: definições configuráveis (tipo, opções, obrigatório, ordem, condição de visibilidade, categorias/tipos a que se aplicam, se são filtro) e valores por anúncio. Semeia os 12 campos da especificação, incluindo a condição dos trabalhadores.
- Anúncios novos ou editados ficam pendentes até aprovação no back-office (configurável). Estados: pendente, publicado, rejeitado, expirado, vendido.
- Publicar é gratuito. Prepara o modelo para destaques pagos, mas sem pagamentos nem UI de planos.
- Nome público do anunciante separado do login; nunca mostrar emails.
- Localizações: os 18 distritos e 277 concelhos de data/localizacoes.json, mais Ourém (Santarém), Açores e Madeira.
- Categoria Imobiliário com slug imobiliario e 301 de /listing-category/tecnologia/.

Entregáveis por fases. Para no fim de cada fase, mostra-me o que fizeste e espera pelo meu OK:
1. Projeto, base de dados, seeds (categorias, localizações, tipos, campos), autenticação e layout base.
2. Páginas públicas: início, listagem com filtros e ordenação, categoria, localização, anúncio, blog, páginas institucionais, sitemap.xml, robots.txt, JSON-LD.
3. Conta e publicação: registo, login, recuperar password, painel, os meus anúncios, favoritos, editar conta, apagar conta, publicar/editar anúncio com upload de fotos, contacto ao anunciante, denúncias.
4. Back-office: moderação, anúncios, utilizadores, denúncias, mensagens, categorias, localizações, campos, blog, páginas, redirects, definições.
5. Migração: script idempotente que importa de um dump MySQL do WordPress (anúncios + postmeta + termos, utilizadores com hashes de password, artigos com metadados do Yoast, imagens de wp-content/uploads) e um teste que confirma que cada URL de data/urls_atuais.txt devolve 200 ou 301.
6. Deploy: Dockerfile, cloudbuild.yaml, instruções para Cloud Run + Cloud SQL + Cloud Storage + Secret Manager, e um README.

Escreve testes para as regras de negócio (validação do anúncio, campos condicionais, estados, permissões, redirects) e testes end-to-end com Playwright para o fluxo: registar → publicar → aprovar como admin → ver o anúncio na listagem.

Se algo na especificação estiver marcado como "provável" ou "a confirmar", implementa a opção mais simples e deixa uma nota na lista de perguntas no README em vez de inventar.
```

---

## Antes de entregar ao Claude Code

1. **Confirmar o formulário de publicação.** Abre `/post-an-ad/` com sessão iniciada e compara com a secção 5 da especificação, ou exporta os campos no wp-admin (Classified Listing → Custom Fields / Form Builder). Os campos marcados como "provável" ficam confirmados ou caem.
2. **Confirmar definições no wp-admin:** moderação de anúncios novos (pendente ou publicado logo), validade dos anúncios em dias, limite de fotos por anúncio, se o chat do plugin está ligado.
3. **Exportar a base de dados e os uploads** do WordPress para a fase 5.
