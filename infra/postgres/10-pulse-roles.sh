#!/bin/sh
# Runs only on a NEW production volume. Bootstrap superuser is never used by Strapi.
set -eu
: "${PULSE_APP_DB_USER:?Configurare ruolo applicativo}"
: "${PULSE_APP_DB_PASSWORD:?Configurare password applicativa distinta}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
 --set=app_user="$PULSE_APP_DB_USER" --set=app_password="$PULSE_APP_DB_PASSWORD" --set=app_database="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname=:'app_user')
\gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'app_database', :'app_user')
\gexec
SQL
