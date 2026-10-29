#!/usr/bin/env bash
# Importa o WordPress para a base de dados e o bucket de um ambiente, e confirma o resultado.
# Correr no Cloud Shell, dentro da pasta do repositório, depois do deploy/gcp-setup.sh:
#   ./deploy/gcp-import.sh ID-DO-PROJETO staging /caminho/dump.sql /caminho/pasta-com-uploads
# O dump e os uploads têm dados pessoais: ficam FORA da pasta do repositório e apagam-se no fim.
set -euo pipefail

PROJECT="${1:?Uso: ./deploy/gcp-import.sh ID-DO-PROJETO staging|production dump.sql pasta-uploads}"
ENV="${2:?Indique o ambiente: staging ou production}"
SQL=$(realpath "${3:?Falta o caminho do dump .sql}")
UPLOADS=$(realpath "${4:?Falta a pasta que contém uploads/}")
[ -f "$SQL" ] || { echo "Não encontro o dump: $SQL"; exit 1; }
[ -d "$UPLOADS" ] || { echo "Não encontro a pasta: $UPLOADS"; exit 1; }

# A importação nunca envia emails.
EMAIL_DRIVER=log "$(dirname "$0")/gcp-run.sh" "$PROJECT" "$ENV" bash -c '
  set -e
  npx tsx scripts/migrate.ts
  npx tsx scripts/seed.ts
  npx tsx scripts/wp-import.ts --sql "$0" --uploads "$1"
  npx tsx scripts/wp-verify.ts --sql "$0"
' "$SQL" "$UPLOADS"

cat <<EOF

Importação feita: o site (${ENV}) já mostra os dados.
Apague agora o dump e os uploads do Cloud Shell (têm dados pessoais):
  rm -rf "$SQL" "$UPLOADS"
EOF
