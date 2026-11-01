#!/usr/bin/env bash
# Liga o "Continuar com o Google" no dev e na produção (os que existirem).
# Correr no Cloud Shell, dentro da pasta do repositório, depois de criar o cliente OAuth na consola:
#   ./deploy/gcp-google-login.sh ID-DO-PROJETO
# Pede o Client ID e o Client secret (o secret não aparece no ecrã) e guarda-os no Secret Manager.
# Pode ser repetido (ex.: para trocar o secret); não reconstrói a imagem, só atualiza os serviços.
set -euo pipefail

PROJECT="${1:?Uso: ./deploy/gcp-google-login.sh ID-DO-PROJETO}"
REGION=europe-west1
gcloud config set project "$PROJECT" >/dev/null

read -rp "Client ID do Google (termina em .apps.googleusercontent.com): " CLIENT_ID
case "$CLIENT_ID" in *.apps.googleusercontent.com) ;; *) echo "Isto não parece um Client ID do Google."; exit 1 ;; esac
read -rsp "Client secret do Google: " CLIENT_SECRET; echo
[ -n "$CLIENT_SECRET" ] || { echo "Falta o Client secret."; exit 1; }

put() { # cria o segredo ou acrescenta uma versão nova
  if gcloud secrets describe "$1" >/dev/null 2>&1; then printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; fi
}
put pdt-google-client-id "$CLIENT_ID"
put pdt-google-client-secret "$CLIENT_SECRET"
unset CLIENT_SECRET

for SUFFIX in dev producao; do
  SERVICE="portal-do-trespasse-${SUFFIX}"
  SA="pdt-${SUFFIX}@${PROJECT}.iam.gserviceaccount.com"
  gcloud run services describe "$SERVICE" --region="$REGION" >/dev/null 2>&1 || { echo "($SERVICE não existe; ignorado)"; continue; }
  for s in pdt-google-client-id pdt-google-client-secret; do
    gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor >/dev/null
  done
  # --update-secrets acrescenta estes dois e mantém os outros segredos e variáveis do serviço.
  gcloud run services update "$SERVICE" --region="$REGION" \
    --update-secrets="GOOGLE_CLIENT_ID=pdt-google-client-id:latest,GOOGLE_CLIENT_SECRET=pdt-google-client-secret:latest" >/dev/null
  echo "Login com o Google ligado em ${SERVICE}."
done

cat <<EOF

Pronto. O botão "Continuar com o Google" aparece em /my-account/ assim que o código novo estiver nesse ambiente.
Endereços de retorno que têm de estar no cliente OAuth (Authorized redirect URIs):
  https://portaldotrespasse.pt/api/auth/google/callback/
  https://dev.portaldotrespasse.pt/api/auth/google/callback/
EOF
