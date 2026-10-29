# Portal do Trespasse

Site novo do [portaldotrespasse.pt](https://portaldotrespasse.pt), que substitui o WordPress.
Next.js 16 + PostgreSQL (Drizzle), pensado para Google Cloud Run.

- `ESPECIFICACAO.md`: o que o site faz, campos, URLs, emails, back-office e migração.
- `PROMPT_CLAUDE_CODE.md`: plano por fases.
- `prototipo/`: protótipo navegável de referência.
- `data/`: dados de referência (categorias, localizações, campos) e snapshot público.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local        # sem DATABASE_URL usa PGlite em ./.data
npm run db:setup                  # migrações + dados de referência
npm run dev                       # http://localhost:3000
npm test                          # testes unitários
```

Os emails não são enviados em desenvolvimento: ficam registados e podem ser lidos em
`/dev/emails/`. Teste de ponta a ponta (com o servidor a correr):
`node e2e/auth-flow.mjs http://localhost:3000`.

Alterar a base de dados: editar `src/db/schema.ts` e correr `npm run db:generate`.

### Importar do WordPress

Com o dump SQL do phpMyAdmin e a pasta `wp-content/uploads` (nunca dentro do repositório):

```bash
npx tsx scripts/wp-import.ts --sql /caminho/dump.sql --uploads /caminho/wp-content
npx tsx scripts/wp-verify.ts --sql /caminho/dump.sql    # compara o dump com a base nova
```

Importa os utilizadores verificados, os anúncios (com campos, fotos e estatísticas), os artigos
do blog (publicados e rascunhos) e as mensagens do formulário de contacto.
Pode correr várias vezes: atualiza pelo ID do WordPress e não mexe em passwords já convertidas.
O passo a passo do dia da mudança está em [docs/MIGRACAO.md](docs/MIGRACAO.md).

### Testes

```bash
npm test                                   # unitários
npx tsx scripts/e2e-fixtures.ts            # utilizadores de teste (só desenvolvimento)
node e2e/auth-flow.mjs http://localhost:3000
node e2e/public-flow.mjs http://localhost:3000     # precisa dos anúncios importados
node e2e/advertiser-flow.mjs http://localhost:3000 # publicar, editar, favoritos, conta
node e2e/admin-flow.mjs http://localhost:3000      # back-office: moderação, utilizadores, emails…
node e2e/url-coverage.mjs http://localhost:3000    # os 415 URLs do WordPress
```

Em desenvolvimento, as imagens ficam em `MEDIA_DIR` (por omissão `./.data/media`).

## Google Cloud (dev e produção)

| Ramo no GitHub | Ambiente | Endereço | Serviço Cloud Run | Base de dados | Emails |
|---|---|---|---|---|---|
| `dev` | site de testes (pede password, não indexado) | dev.portaldotrespasse.pt | `portal-do-trespasse-dev` | `portal_dev` | só para `EMAIL_ONLY_TO` |
| `main` | produção | portaldotrespasse.pt | `portal-do-trespasse-producao` | `portal_producao` | todos |

**Deploy automático:** cada push num destes ramos constrói a imagem no Cloud Build e atualiza o serviço
correspondente (`cloudbuild.yaml`, cerca de 5 minutos). As migrações da base de dados correm sozinhas quando o
contentor novo arranca. Fluxo normal: trabalho → `dev` → testar em dev.portaldotrespasse.pt → `main`.

**Cache:** não é preciso fazer nada a cada deploy.
- As páginas são geradas a cada pedido e nunca ficam em cache (`Cache-Control: no-store`).
- O CSS e o JS têm um código no nome do ficheiro que muda quando o conteúdo muda, por isso podem ficar em cache um ano.
- Cada build leva a versão do commit (`NEXT_DEPLOYMENT_ID`). Quem tinha uma página antiga aberta carrega a nova na navegação seguinte.
- As fotografias têm nomes únicos e nunca são substituídas.

**Arquitetura:**
- Cloud Run (o site, um contentor).
- Cloud SQL Postgres 16: uma instância `pdt-sql`, com uma base por ambiente.
- Cloud Storage: fotografias num bucket privado, servido em `/media/`.
- Secret Manager (passwords), Cloud Scheduler (tarefas diárias) e Cloud Build (imagens e deploys).
- Emails por SMTP (`smtp-pt.securemail.pro`, conta `geral@portaldotrespasse.pt`).
- Região `europe-west1`. DNS na Cloudflare.

### Criar um ambiente (uma vez)

No **Cloud Shell** (o terminal do Google Cloud no browser, já autenticado):

```bash
git clone https://github.com/tiagomendesmarques/portal-do-trespasse.git && cd portal-do-trespasse
git checkout dev
./deploy/gcp-setup.sh ID-DO-PROJETO dev
```

O script pode ser repetido: só cria o que falta e faz um deploy novo. Na primeira vez:
- Pede a password do email `geral@` e a password do site de testes. São escritas no terminal e guardadas no Secret Manager.
- Pergunta que emails podem receber mensagens a sério no `dev`. Os outros ficam só registados no back-office.
- Cria:
  - a base de dados (cerca de 10 min);
  - o bucket e a conta de serviço;
  - os segredos;
  - a imagem e o serviço;
  - a tarefa diária;
  - o gatilho de deploy automático.
- **Primeira vez apenas:**
  - Se o GitHub ainda não estiver ligado ao Cloud Build, o script mostra o link para o ligar.
  - Se o domínio ainda não estiver verificado, pede `gcloud domains verify portaldotrespasse.pt`.
  - Depois disso, voltar a correr o script.
- No fim mostra o registo DNS a criar na Cloudflare (nuvem cinzenta).

Importar o WordPress (dump e uploads carregados no Cloud Shell, **fora** do repositório):

```bash
./deploy/gcp-import.sh ID-DO-PROJETO dev ~/wp/dump.sql ~/wp/uploads-pasta
rm -rf ~/wp                                   # dados pessoais: apagar no fim
```

Entrar no back-office com a conta de administrador do WordPress (mesma password).

### Atualizar o dev com dados mais recentes do WordPress

Exportar um dump novo (phpMyAdmin) e correr o mesmo `gcp-import.sh`. Pode ser repetido sempre que quiser:
- Contas e anúncios novos entram. Os anúncios à espera de aprovação no WordPress vão para a fila do back-office.
- Os existentes são atualizados.
- Passwords mudadas no WordPress passam, exceto as de quem já entrou no site novo.
- Fotografias já importadas mantêm-se. Basta enviar os uploads **novos** (ex.: só `uploads/2026/11/`); a pasta tem de manter a estrutura `uploads/ANO/MÊS/`.
- O que foi apagado no WordPress não desaparece do dev. No dia da mudança a produção começa com a base vazia, por isso fica exata.

A produção faz-se no dia da mudança com os mesmos scripts e `production` (ver [docs/MIGRACAO.md](docs/MIGRACAO.md)).

Para fazer estes passos com o Claude no Chrome: [docs/PROMPT_CHROME_DEV.md](docs/PROMPT_CHROME_DEV.md) (dev) e
[docs/PROMPT_CHROME_PRODUCAO.md](docs/PROMPT_CHROME_PRODUCAO.md) (passar portaldotrespasse.pt para o site novo).
