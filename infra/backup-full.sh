#!/usr/bin/env bash
set -euo pipefail
umask 077
source "$(dirname "$0")/compose-command.sh"
BACKUP_DIR=${BACKUP_DIR:-$PULSE_ROOT/backups/full}
BACKUP_KEEP_DAYS=${BACKUP_KEEP_DAYS:-30}
: "${BACKUP_RECIPIENT:?Configurare fingerprint GPG destinatario}"
: "${GNUPGHOME:?Configurare keyring GPG con sola chiave pubblica destinatario}"
[[ $BACKUP_KEEP_DAYS =~ ^[0-9]+$ ]] && ((BACKUP_KEEP_DAYS>=1)) || { echo 'Retention non valida' >&2; exit 1; }
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || { echo 'Backup già in esecuzione' >&2; exit 1; }
work=$(mktemp -d "$BACKUP_DIR/.pending-XXXXXXXX")
name="pulse-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gpg"
resume=0
cleanup(){
 result=$?
 trap - EXIT
 if ((resume)); then "${compose[@]}" up -d --no-build --wait frontend strapi >/dev/null || result=1; fi
 rm -rf "$work"
 if ((result)); then echo 'ERRORE backup PULSE: controllare spazio, GPG, Docker e destinazione esterna.' >&2; else echo "Backup PULSE completato: $name"; fi
 exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Fail before stopping the app if no valid encryption recipient exists.
gpg --batch --list-keys "$BACKUP_RECIPIENT" >/dev/null
running=$("${compose[@]}" ps --status running --services)
[[ $running == *strapi* ]] && resume=1
"${compose[@]}" stop frontend strapi >/dev/null
"${compose[@]}" exec -T postgres sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$work/database.dump"
[[ -s $work/database.dump ]]
"${compose[@]}" exec -T postgres sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1' < infra/table-counts.sql > "$work/database-counts.tsv"
"${compose[@]}" run --rm --no-deps -T --entrypoint tar strapi -C /app/public/uploads -cf - . > "$work/uploads.tar"
mkdir "$work/config"
cp "$PULSE_ENV_FILE" "$work/config/runtime.env"
cp "$PULSE_COMPOSE_FILE" "$work/config/compose.yml"
cp -R infra "$work/config/infra"
# Separate names prevent lockfile collision and identify the exact source revision.
cp backend/package-lock.json "$work/config/backend-package-lock.json"
cp frontend/package-lock.json "$work/config/frontend-package-lock.json"
git -c safe.directory="$PULSE_ROOT" rev-parse HEAD > "$work/config/source-commit.txt"
git -c safe.directory="$PULSE_ROOT" status --porcelain > "$work/config/worktree-status.txt"
"${compose[@]}" images --format json > "$work/config/images.json"
if [[ -n ${PULSE_CONFIG:-} ]]; then cp "$PULSE_CONFIG" "$work/config/backup-config.sh"; fi
# Includes Caddy certificates, ACME account and internal CA keys when the proxy exists.
if "${compose[@]}" config --services | grep -qx proxy; then
 "${compose[@]}" run --rm --no-deps -T --entrypoint tar proxy -C /data -cf - . > "$work/caddy-data.tar"
fi
(cd "$work"; sha256sum database.dump database-counts.tsv uploads.tar > SHA256SUMS; find config -type f -exec sha256sum '{}' + >> SHA256SUMS; [[ ! -f caddy-data.tar ]] || sha256sum caddy-data.tar >> SHA256SUMS)
tar -C "$work" -cf - . | gpg --batch --yes --trust-model always --recipient "$BACKUP_RECIPIENT" --encrypt --output "$BACKUP_DIR/.$name.pending"
mv "$BACKUP_DIR/.$name.pending" "$BACKUP_DIR/$name"
if ((resume)); then "${compose[@]}" up -d --no-build --wait frontend strapi >/dev/null; resume=0; fi
# SSH host-key verification must already be set up; encryption happens before transfer.
if [[ -n ${BACKUP_REMOTE:-} ]]; then
 : "${BACKUP_SSH_KEY:?Configurare chiave SSH dedicata per backup esterno}"
 rsync -a --chmod=F600 -e "ssh -i $BACKUP_SSH_KEY -o BatchMode=yes -o StrictHostKeyChecking=yes" -- "$BACKUP_DIR/$name" "$BACKUP_REMOTE"
fi
# Rotate only completed encrypted archives, and only after all required transfers succeed.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pulse-*.tar.gpg' -mtime "+$BACKUP_KEEP_DAYS" -delete
