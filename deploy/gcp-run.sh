#!/usr/bin/env bash
# Corre um comando ligado à base de dados e ao bucket de um ambiente (via Cloud SQL Auth Proxy).
# Correr no Cloud Shell, dentro da pasta do repositório. Exemplos:
#   ./deploy/gcp-run.sh ID-DO-PROJETO production npx tsx scripts/send-migration-notice.ts
#   ./deploy/gcp-run.sh ID-DO-PROJETO dev npx tsx scripts/sql.ts "select count(*) from listings"
set -euo pipefail

PROJECT="${1:?Uso: ./deploy/gcp-run.sh ID-DO-PROJETO dev|production comando...}"
ENV="${2:?Indique o ambiente: dev ou production}"
shift 2
[ $# -gt 0 ] || { echo "Falta o comando a correr."; exit 1; }
case "$ENV" in dev) SUFFIX=dev ;; production) SUFFIX=producao ;; *) echo "Ambiente desconhecido: $ENV"; exit 1 ;; esac
REGION=europe-west1
SQL_INSTANCE=pdt-sql
PORT=5433

node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || { echo "É preciso Node 20 ou mais recente (nvm install 22)."; exit 1; }
gcloud config set project "$PROJECT" >/dev/null
# A biblioteca do Cloud Storage e o proxy usam as credenciais "application default".
gcloud auth application-default print-access-token >/dev/null 2>&1 || gcloud auth application-default login
[ -d node_modules ] || npm ci --no-audit --no-fund

PROXY=$(command -v cloud-sql-proxy || true)
if [ -z "$PROXY" ]; then
  PROXY="$HOME/cloud-sql-proxy"
  [ -x "$PROXY" ] || { curl -sSLo "$PROXY" https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64 && chmod +x "$PROXY"; }
fi
"$PROXY" --port "$PORT" "${PROJECT}:${REGION}:${SQL_INSTANCE}" >/tmp/cloud-sql-proxy.log 2>&1 &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do (echo >/dev/tcp/127.0.0.1/$PORT) 2>/dev/null && break; sleep 1; done

# O segredo aponta para o socket do Cloud Run; aqui liga-se pelo proxy local.
DATABASE_URL=$(gcloud secrets versions access latest --secret="pdt-${SUFFIX}-database-url" | sed -E "s#@/([^?]+)\?host=.*#@127.0.0.1:${PORT}/\1#")
export DATABASE_URL MEDIA_DRIVER=gcs GCS_BUCKET="${PROJECT}-pdt-${SUFFIX}-media"
export SITE_ENV="$([ "$ENV" = dev ] && echo staging || echo production)"
export SITE_URL="https://$([ "$ENV" = dev ] && echo dev.)portaldotrespasse.pt"
# Emails: por omissão só regista. Para enviar a sério (ex.: aviso de mudança), EMAIL_DRIVER=smtp antes do comando.
export EMAIL_DRIVER="${EMAIL_DRIVER:-log}" SMTP_HOST=smtp-pt.securemail.pro SMTP_PORT=465 SMTP_USER=geral@portaldotrespasse.pt
if [ "$EMAIL_DRIVER" = smtp ]; then
  SMTP_PASSWORD=$(gcloud secrets versions access latest --secret=pdt-smtp-password); export SMTP_PASSWORD
fi

"$@"
