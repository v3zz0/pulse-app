#!/usr/bin/env bash
# Restore into NEW isolated Docker volumes/container only. Never targets a running app DB.
set -euo pipefail
umask 077
archive=${1:?Uso: restore-isolated.sh backup.tar.gpg [report-directory]}
report=${2:-/tmp/pulse-restore-report-$(date -u +%Y%m%dT%H%M%SZ)}
[[ ! -e $report ]] || { echo 'La directory report esiste già' >&2; exit 1; }
mkdir -m 700 "$report"
work=$(mktemp -d)
container="pulse-restore-$(date -u +%Y%m%d%H%M%S)-$$"
volume="${container}-uploads"
image=postgres:17-alpine@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7
cleanup(){ result=$?;trap - EXIT;docker rm -f "$container" >/dev/null 2>&1 || true;docker volume rm "$volume" >/dev/null 2>&1 || true;rm -rf "$work";((result==0)) || echo 'ERRORE ripristino isolato: backup NON convalidato.' >&2;exit "$result"; }
trap cleanup EXIT
gpg --batch --decrypt --output "$work/archive.tar" "$archive"
# Reject absolute/traversal entries before unpacking an archive from protected storage.
python3 - "$work/archive.tar" <<'PY'
import sys,tarfile,pathlib
with tarfile.open(sys.argv[1]) as t:
 for m in t.getmembers():
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or m.issym() or m.islnk():raise SystemExit('Archivio non sicuro')
PY
tar -C "$work" -xf "$work/archive.tar"
(cd "$work"; sha256sum -c SHA256SUMS > "$report/checksums.txt")
# No ports and no network: even a restored Strapi session/admin token is never exposed.
docker run -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
for ((n=0;n<60;n++)); do if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi;sleep 1;done
docker exec "$container" createdb -U postgres pulse_restore
docker exec -i "$container" pg_restore -U postgres -d pulse_restore --no-owner --no-privileges --exit-on-error < "$work/database.dump"
docker exec "$container" psql -U postgres -d pulse_restore -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" > "$report/table-count.txt"
docker exec -i "$container" psql -U postgres -d pulse_restore -At -v ON_ERROR_STOP=1 < "$work/config/infra/table-counts.sql" > "$report/database-counts.tsv"
cmp "$work/database-counts.tsv" "$report/database-counts.tsv"
docker exec "$container" pg_dump -U postgres -d pulse_restore --schema-only --no-owner --no-privileges > "$report/restored-schema.sql"
docker volume create "$volume" >/dev/null
# Validate uploads in a throwaway volume, preserving original volumes and files.
docker run --rm -i --network none -v "$volume:/restore" --entrypoint tar "$image" -C /restore -xf - < "$work/uploads.tar"
docker run --rm --network none -v "$volume:/restore:ro" --entrypoint sh "$image" -c 'cd /restore; find . -type f -exec sha256sum {} \;' > "$report/uploads-checksums.txt"
# Only redacted metrics are retained; decrypted config and source data are removed by the trap.
printf 'PASS: database e upload ripristinati in container/volume isolati; originali invariati.\n' > "$report/result.txt"
cat "$report/result.txt"
