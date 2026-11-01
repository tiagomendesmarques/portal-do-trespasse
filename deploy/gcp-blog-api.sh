#!/usr/bin/env bash
# Liga a API de artigos (/api/v1/artigos/) no dev e na produção (os que existirem).
# Correr no Cloud Shell, dentro da pasta do repositório:
#   ./deploy/gcp-blog-api.sh ID-DO-PROJETO            (cria a chave na primeira vez; depois mantém-na)
#   ./deploy/gcp-blog-api.sh ID-DO-PROJETO --nova     (troca a chave: a antiga deixa de funcionar)
# Não reconstrói a imagem: só guarda a chave no Secret Manager e liga-a aos serviços.
set -euo pipefail

PROJECT="${1:?Uso: ./deploy/gcp-blog-api.sh ID-DO-PROJETO [--nova]}"
REGION=europe-west1
SECRET=pdt-blog-api-token
gcloud config set project "$PROJECT" >/dev/null

if ! gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create "$SECRET" --replication-policy=automatic --data-file=- >/dev/null
  echo "Chave da API de artigos criada."
elif [ "${2:-}" = "--nova" ]; then
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add "$SECRET" --data-file=- >/dev/null
  echo "Chave da API de artigos trocada."
fi

for SUFFIX in dev producao; do
  SERVICE="portal-do-trespasse-${SUFFIX}"
  gcloud run services describe "$SERVICE" --region="$REGION" >/dev/null 2>&1 || { echo "($SERVICE não existe; ignorado)"; continue; }
  gcloud secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:pdt-${SUFFIX}@${PROJECT}.iam.gserviceaccount.com" --role=roles/secretmanager.secretAccessor >/dev/null
  # --update-secrets acrescenta este e mantém os outros segredos e variáveis do serviço.
  gcloud run services update "$SERVICE" --region="$REGION" --update-secrets="BLOG_API_TOKEN=${SECRET}:latest" >/dev/null
  echo "API de artigos ligada em ${SERVICE}."
done

cat <<EOF

Pronto. Para ver a chave (para a pôr no ambiente do Claude Code como PDT_BLOG_TOKEN):
  gcloud secrets versions access latest --secret=${SECRET}
Não a cole em chats nem em ficheiros do repositório.
EOF
