#!/usr/bin/env bash
# Sourced by backup/restore utilities. PULSE_CONFIG is a private Bash assignment file.
set -euo pipefail
if [[ -n ${PULSE_CONFIG:-} ]]; then
 mode=$(stat -c %a "$PULSE_CONFIG")
 (( (8#$mode & 8#077) == 0 )) || { echo 'La configurazione backup deve avere permessi 0600' >&2; exit 1; }
 source "$PULSE_CONFIG"
fi
PULSE_ROOT=${PULSE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
PULSE_COMPOSE_FILE=${PULSE_COMPOSE_FILE:-$PULSE_ROOT/docker-compose.yml}
PULSE_ENV_FILE=${PULSE_ENV_FILE:-$PULSE_ROOT/.env}
PULSE_PROJECT=${PULSE_PROJECT:-pulse}
compose=(docker compose --project-directory "$PULSE_ROOT" --env-file "$PULSE_ENV_FILE" -f "$PULSE_COMPOSE_FILE" -p "$PULSE_PROJECT")
cd "$PULSE_ROOT"
