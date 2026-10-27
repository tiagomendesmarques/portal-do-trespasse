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
     --set-env-vars BASIC_AUTH_USER=equipa,BASIC_AUTH_PASSWORD=ESCOLHER
   ```
   (Para produção, mover a password da base de dados para o Secret Manager.)
5. Gatilho: Cloud Build → Gatilhos → ligar o repositório GitHub → ficheiro `cloudbuild.yaml`.
   Dar à conta de serviço do Cloud Build os papéis *Cloud Run Admin* e *Service Account User*.
6. Domínio: Cloud Run → Gerir domínios personalizados → `staging.portaldotrespasse.pt`.
   Na Cloudflare, criar o registo CNAME indicado, com o proxy desligado (nuvem cinzenta)
   até o certificado ser emitido.

O contentor aplica as migrações e os dados de referência ao arrancar.
