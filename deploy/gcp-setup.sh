#!/usr/bin/env bash
# Cria (ou atualiza) o Portal do Trespasse no Google Cloud: staging ou produção.
# Correr no Cloud Shell, dentro da pasta do repositório:
#   ./deploy/gcp-setup.sh ID-DO-PROJETO staging
#   ./deploy/gcp-setup.sh ID-DO-PROJETO production     (no dia da mudança, ver docs/MIGRACAO.md)
# Pode ser repetido: o que já existe é mantido; só cria o que falta e faz um deploy novo.
# Pede as passwords no terminal (não ficam no histórico nem no Git) e guarda-as no Secret Manager.
set -euo pipefail

PROJECT="${1:?Uso: ./deploy/gcp-setup.sh ID-DO-PROJETO staging|production}"
ENV="${2:?Indique o ambiente: staging ou production}"
case "$ENV" in
  staging)    SUFFIX=staging; DOMAIN=staging.portaldotrespasse.pt ;;
  production) SUFFIX=producao; DOMAIN=portaldotrespasse.pt ;;
  *) echo "Ambiente desconhecido: $ENV (staging ou production)"; exit 1 ;;
esac
REGION=europe-west1
SQL_INSTANCE=pdt-sql                 # uma instância para os dois ambientes (bases de dados separadas)
DB="portal_${SUFFIX}"
SERVICE="portal-do-trespasse-${SUFFIX}"
REPO=portal-do-trespasse
BUCKET="${PROJECT}-pdt-${SUFFIX}-media"
SA_NAME="pdt-${SUFFIX}"
SA="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
SECRET_PREFIX="pdt-${SUFFIX}"
SMTP_HOST=smtp-pt.securemail.pro
SMTP_USER=geral@portaldotrespasse.pt

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
secret_exists() { gcloud secrets describe "$1" >/dev/null 2>&1; }
put_secret() { printf '%s' "$2" | gcloud secrets create "$1" --replication-policy=automatic --data-file=- >/dev/null; }
grant_secret() { gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:${SA}" --role=roles/secretmanager.secretAccessor >/dev/null; }

gcloud config set project "$PROJECT" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')

step "1/9 APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  sqladmin.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com storage.googleapis.com iam.googleapis.com

step "2/9 Repositório de imagens e permissões do Cloud Build"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION"
# Os builds correm com a conta predefinida do Compute; em projetos novos ela vem sem permissões.
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for role in roles/artifactregistry.writer roles/logging.logWriter roles/storage.objectViewer roles/run.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${BUILD_SA}" --role="$role" --condition=None >/dev/null
done

step "3/9 Base de dados (Cloud SQL Postgres 16; a primeira vez demora ~10 minutos)"
gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1 ||
  gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=ENTERPRISE --tier=db-f1-micro \
    --region="$REGION" --storage-size=10 --storage-auto-increase --backup-start-time=03:00 --availability-type=zonal
gcloud sql databases describe "$DB" --instance="$SQL_INSTANCE" >/dev/null 2>&1 ||
  gcloud sql databases create "$DB" --instance="$SQL_INSTANCE"
if ! secret_exists ${SECRET_PREFIX}-database-url; then
  DB_PASS=$(openssl rand -hex 24)
  if gcloud sql users list --instance="$SQL_INSTANCE" --format='value(name)' | grep -qx "$DB"; then
    gcloud sql users set-password "$DB" --instance="$SQL_INSTANCE" --password="$DB_PASS"
  else
    gcloud sql users create "$DB" --instance="$SQL_INSTANCE" --password="$DB_PASS"
  fi
  put_secret ${SECRET_PREFIX}-database-url "postgres://${DB}:${DB_PASS}@/${DB}?host=/cloudsql/${PROJECT}:${REGION}:${SQL_INSTANCE}"
  unset DB_PASS
fi

step "4/9 Fotografias (Cloud Storage, privado: o site serve-as em /media/)"
gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" --uniform-bucket-level-access --public-access-prevention

step "5/9 Conta de serviço do site"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$SA_NAME" --display-name="Portal do Trespasse (${ENV})"
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:${SA}" --role=roles/cloudsql.client --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" --member="serviceAccount:${SA}" --role=roles/storage.objectAdmin >/dev/null

step "6/9 Segredos"
if ! secret_exists pdt-smtp-password; then
  read -rsp "Password do email ${SMTP_USER}: " SMTP_PASS; echo
  put_secret pdt-smtp-password "$SMTP_PASS"; unset SMTP_PASS
fi
if [ "$ENV" = staging ] && ! secret_exists "${SECRET_PREFIX}-basic-auth-password"; then
  read -rsp "Password para entrar no staging (utilizador \"equipa\"): " BA_PASS; echo
  put_secret "${SECRET_PREFIX}-basic-auth-password" "$BA_PASS"; unset BA_PASS
fi
secret_exists "${SECRET_PREFIX}-cron-secret" || put_secret "${SECRET_PREFIX}-cron-secret" "$(openssl rand -hex 24)"
SECRETS="${SECRET_PREFIX}-database-url pdt-smtp-password ${SECRET_PREFIX}-cron-secret"
[ "$ENV" = staging ] && SECRETS="$SECRETS ${SECRET_PREFIX}-basic-auth-password"
for s in $SECRETS; do grant_secret "$s"; done
ONLY_TO=$(gcloud run services describe "$SERVICE" --region="$REGION" --format=json 2>/dev/null |
  python3 -c 'import json,sys; e=json.load(sys.stdin)["spec"]["template"]["spec"]["containers"][0].get("env",[]); print(next((x["value"] for x in e if x["name"]=="EMAIL_ONLY_TO"),""))' 2>/dev/null || true)
if [ "$ENV" = staging ] && [ -z "$ONLY_TO" ]; then
  read -rp "No staging, que emails podem receber mensagens a sério? (vírgulas) [${SMTP_USER}]: " ONLY_TO
  ONLY_TO=${ONLY_TO:-$SMTP_USER}
fi

step "7/9 Construir a imagem (Cloud Build, ~5 minutos)"
TAG="${ENV}-$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/app:${TAG}"
gcloud builds submit --config=deploy/build.yaml --substitutions="_IMAGE=${IMAGE}" --timeout=1800 .

step "8/9 Deploy no Cloud Run"
ENV_VARS="SITE_ENV=${ENV}|SITE_URL=https://${DOMAIN}|MEDIA_DRIVER=gcs|GCS_BUCKET=${BUCKET}|EMAIL_DRIVER=smtp|SMTP_HOST=${SMTP_HOST}|SMTP_PORT=465|SMTP_USER=${SMTP_USER}"
SECRET_VARS="DATABASE_URL=${SECRET_PREFIX}-database-url:latest,SMTP_PASSWORD=pdt-smtp-password:latest,CRON_SECRET=${SECRET_PREFIX}-cron-secret:latest"
if [ "$ENV" = staging ]; then
  # Staging: protegido por password e só envia emails a sério para EMAIL_ONLY_TO.
  ENV_VARS="${ENV_VARS}|BASIC_AUTH_USER=equipa|EMAIL_ONLY_TO=${ONLY_TO}"
  SECRET_VARS="${SECRET_VARS},BASIC_AUTH_PASSWORD=${SECRET_PREFIX}-basic-auth-password:latest"
fi
# max-instances=1: as migrações correm no arranque e não devem correr em dois contentores ao mesmo tempo.
gcloud run deploy "$SERVICE" --image="$IMAGE" --region="$REGION" --service-account="$SA" \
  --add-cloudsql-instances="${PROJECT}:${REGION}:${SQL_INSTANCE}" \
  --allow-unauthenticated --min-instances=0 --max-instances=1 --memory=1Gi --cpu=1 --timeout=300 \
  --set-env-vars="^|^${ENV_VARS}" --set-secrets="${SECRET_VARS}"
URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
# Os deploys automáticos (cloudbuild.yaml) precisam de poder usar a conta de serviço do site.
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:${BUILD_SA}" --role=roles/iam.serviceAccountUser >/dev/null

step "9/9 Tarefas diárias (Cloud Scheduler, 6h07 de Lisboa)"
CRON=$(gcloud secrets versions access latest --secret=${SECRET_PREFIX}-cron-secret)
if gcloud scheduler jobs describe "pdt-${SUFFIX}-diario" --location="$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "pdt-${SUFFIX}-diario" --location="$REGION" --schedule="7 6 * * *" --time-zone=Europe/Lisbon \
    --http-method=POST --uri="${URL}/api/cron/daily/" --update-headers="X-Cron-Secret=${CRON}" --attempt-deadline=320s >/dev/null
else
  gcloud scheduler jobs create http "pdt-${SUFFIX}-diario" --location="$REGION" --schedule="7 6 * * *" --time-zone=Europe/Lisbon \
    --http-method=POST --uri="${URL}/api/cron/daily/" --headers="X-Cron-Secret=${CRON}" --attempt-deadline=320s >/dev/null
fi
unset CRON

step "Domínio"
DOMAINS="$DOMAIN"
[ "$ENV" = production ] && DOMAINS="$DOMAIN www.${DOMAIN}"   # o site redireciona www → sem www
for d in $DOMAINS; do
  if gcloud beta run domain-mappings describe --domain="$d" --region="$REGION" >/dev/null 2>&1 ||
     gcloud beta run domain-mappings create --service="$SERVICE" --domain="$d" --region="$REGION" >/dev/null 2>&1; then
    echo "Registos DNS para ${d} (na Cloudflare, nuvem CINZENTA, só DNS):"
    gcloud beta run domain-mappings describe --domain="$d" --region="$REGION" \
      --format='table(status.resourceRecords[].type, status.resourceRecords[].name, status.resourceRecords[].rrdata)'
  else
    echo "Não foi possível ligar ${d}. Primeiro é preciso provar que o domínio é seu (uma só vez):"
    echo "  gcloud domains verify portaldotrespasse.pt    (abre a Search Console; adicionar o registo TXT na Cloudflare)"
    echo "Depois voltar a correr este script."
  fi
done

cat <<EOF

Pronto (${ENV}).
  Endereço provisório: ${URL}$([ "$ENV" = staging ] && echo '   (utilizador "equipa" + a password do staging)')
  Endereço final:      https://${DOMAIN}   (quando o DNS e o certificado estiverem prontos, ~15 min a 1 h)
  Fotografias:         gs://${BUCKET}
  Emails:              SMTP ${SMTP_HOST}$([ "$ENV" = staging ] && echo "; só recebem a sério: ${ONLY_TO}")

Próximo passo: importar os dados do WordPress com ./deploy/gcp-import.sh ${PROJECT} ${ENV} dump.sql pasta-uploads
EOF
