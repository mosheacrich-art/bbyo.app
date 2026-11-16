#!/usr/bin/env bash
# Prueba migraciones + seed + permisos en un Postgres local (sin Supabase ni Docker).
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGHOST="${PGHOST:-/tmp}" PGPORT="${PGPORT:-54329}" PGUSER="${PGUSER:-postgres}"
P="psql -v ON_ERROR_STOP=1 -q -d bbyo_test"
psql -q -d postgres -c "drop database if exists bbyo_test" -c "create database bbyo_test"
$P -f supabase/tests/00_auth_stub.sql
for f in supabase/migrations/*.sql; do $P -f "$f"; done
$P -f supabase/seed.sql
$P -f supabase/tests/rls.test.sql 2>&1 | sed -e 's/^psql:[^ ]* //' -e 's/NOTICE:  //'
