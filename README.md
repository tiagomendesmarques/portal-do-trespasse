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

## Staging no Google Cloud (uma vez)

Região sugerida `europe-west1`. Substitua `PROJETO` pelo ID do projeto.

1. Ativar APIs: Cloud Run, Cloud Build, Artifact Registry, Cloud SQL Admin, Secret Manager.
   ```bash
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com --project PROJETO
   ```
2. Repositório de imagens:
   ```bash
   gcloud artifacts repositories create portal-do-trespasse --repository-format=docker --location=europe-west1 --project PROJETO
   ```
3. Base de dados (a mais pequena chega para staging):
   ```bash
   gcloud sql instances create pdt-staging --database-version=POSTGRES_16 --tier=db-f1-micro --region=europe-west1 --project PROJETO
   gcloud sql databases create portal --instance=pdt-staging --project PROJETO
   gcloud sql users create portal --instance=pdt-staging --password='GERAR-UMA-PASSWORD' --project PROJETO
   ```
4. Primeiro deploy do serviço (depois o Cloud Build atualiza só a imagem):
   ```bash
   gcloud run deploy portal-do-trespasse-staging --source . --region europe-west1 --project PROJETO \
     --add-cloudsql-instances PROJETO:europe-west1:pdt-staging \
     --set-env-vars SITE_ENV=staging,SITE_URL=https://staging.portaldotrespasse.pt,EMAIL_DRIVER=log \
     --set-env-vars "DATABASE_URL=postgres://portal:PASSWORD@/portal?host=/cloudsql/PROJETO:europe-west1:pdt-staging" \
     --set-env-vars BASIC_AUTH_USER=equipa,BASIC_AUTH_PASSWORD=ESCOLHER,CRON_SECRET=GERAR-32-CARACTERES
   ```
   (Para produção, mover a password da base de dados para o Secret Manager.)
5. Gatilho: Cloud Build → Gatilhos → ligar o repositório GitHub → ficheiro `cloudbuild.yaml`.
   Dar à conta de serviço do Cloud Build os papéis *Cloud Run Admin* e *Service Account User*.
6. Domínio: Cloud Run → Gerir domínios personalizados → `staging.portaldotrespasse.pt`.
   Na Cloudflare, criar o registo CNAME indicado, com o proxy desligado (nuvem cinzenta)
   até o certificado ser emitido.
7. Tarefas diárias (expirar anúncios, avisos de expiração, lembretes, limpezas), às 6h de Lisboa:
   ```bash
   gcloud services enable cloudscheduler.googleapis.com --project PROJETO
   gcloud scheduler jobs create http pdt-staging-diario --location europe-west1 --project PROJETO \
     --schedule "7 6 * * *" --time-zone "Europe/Lisbon" --http-method POST \
     --uri https://staging.portaldotrespasse.pt/api/cron/daily/ \
     --headers X-Cron-Secret=O-MESMO-CRON_SECRET --attempt-deadline 300s
   ```
   O resultado da última execução aparece em Back-office → Definições, onde também há o botão "Correr agora".

O contentor aplica as migrações e os dados de referência ao arrancar.
