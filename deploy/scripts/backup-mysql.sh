#!/usr/bin/env bash
# SATRE §8 — mysqldump diario con rotación local y copia a S3/SCP/rclone.
# Secretos solo por entorno. umask 077: dumps con datos de menores (Ley 29733).
set -euo pipefail
umask 077

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_DATABASE="${MYSQL_DATABASE:-satre_coar}"
MYSQL_USER="${MYSQL_USER:-satre_app}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:?Definir MYSQL_PASSWORD}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/satre}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE_TARGET="${REMOTE_TARGET:-}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-}"
RESTORE_TEST="${RESTORE_TEST:-}"

stamp="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
dump_file="${BACKUP_DIR}/${MYSQL_DATABASE}_${stamp}.sql.gz"
log() { printf '%s %s\n' "$(date -Iseconds)" "$*"; }

dump_cmd() {
  if [ -n "$MYSQL_CONTAINER" ]; then
    docker exec -e MYSQL_PWD="$MYSQL_PASSWORD" "$MYSQL_CONTAINER" \
      mysqldump -u"$MYSQL_USER" --single-transaction --quick --hex-blob \
      --routines --triggers --no-tablespaces --skip-comments "$MYSQL_DATABASE"
  else
    MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" \
      --single-transaction --quick --hex-blob --routines --triggers \
      --no-tablespaces --skip-comments "$MYSQL_DATABASE"
  fi
}

log "dump $MYSQL_DATABASE -> $dump_file"
dump_cmd | gzip -9 > "$dump_file"
chmod 600 "$dump_file"
log "dump ok ($(wc -c < "$dump_file") bytes)"

if [ -n "$REMOTE_TARGET" ]; then
  name="$(basename "$dump_file")"
  case "$REMOTE_TARGET" in
    s3://*)
      aws s3 cp "$dump_file" "${REMOTE_TARGET%/}/$name"
      cutoff="$(date -d "${KEEP_DAYS} days ago" +%Y-%m-%d 2>/dev/null || date -v-"${KEEP_DAYS}"d +%Y-%m-%d)"
      aws s3 ls "${REMOTE_TARGET%/}/" | while read -r date _ _ key; do
        [ -n "${key:-}" ] || continue
        [ "$date" \< "$cutoff" ] && aws s3 rm "${REMOTE_TARGET%/}/$key" || true
      done
      ;;
    rclone:*)
      rclone copy "$dump_file" "${REMOTE_TARGET#rclone:}"
      rclone delete "${REMOTE_TARGET#rclone:}" --min-age "${KEEP_DAYS}d"
      ;;
    *)
      scp -p "$dump_file" "${REMOTE_TARGET%/}/$name"
      ssh "${REMOTE_TARGET%%:*}" "find '${REMOTE_TARGET#*:}' -name '${MYSQL_DATABASE}_*.sql.gz' -mtime +${KEEP_DAYS} -delete"
      ;;
  esac
  log "remoto ok $REMOTE_TARGET"
fi

find "$BACKUP_DIR" -name "${MYSQL_DATABASE}_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
log "rotación local KEEP_DAYS=$KEEP_DAYS"

day="$(date +%d)"
dow="$(date +%u)"
if [ "$RESTORE_TEST" = "1" ] || { [ "$day" -le 7 ] && [ "$dow" = "7" ]; }; then
  test_db="${MYSQL_DATABASE}_restore_test"
  log "prueba de restauración mensual -> $test_db"
  mysql_admin() {
    if [ -n "$MYSQL_CONTAINER" ]; then
      docker exec -i -e MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-$MYSQL_PASSWORD}" "$MYSQL_CONTAINER" \
        mysql -u"${MYSQL_ROOT_USER:-root}" "$@"
    else
      MYSQL_PWD="${MYSQL_ROOT_PASSWORD:-$MYSQL_PASSWORD}" mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" \
        -u"${MYSQL_ROOT_USER:-root}" "$@"
    fi
  }
  mysql_admin -e "DROP DATABASE IF EXISTS \`${test_db}\`; CREATE DATABASE \`${test_db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  gunzip -c "$dump_file" | mysql_admin "$test_db"
  tables="$(mysql_admin -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${test_db}';")"
  mysql_admin -e "DROP DATABASE \`${test_db}\`;"
  [ "$tables" -gt 0 ] || { log "restauración: 0 tablas"; exit 1; }
  log "restauración ok ($tables tablas)"
fi
