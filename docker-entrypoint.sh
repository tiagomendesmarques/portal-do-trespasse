#!/bin/sh
# Aplica migrações e dados de referência (ambos idempotentes) e arranca o servidor.
set -e
node dist/migrate.mjs
node dist/seed.mjs
exec node server.js
