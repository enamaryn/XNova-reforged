#!/usr/bin/env bash
# Sauvegarde PostgreSQL compressée, atomique et vérifiée (OPS-01).
#
# Usage : scripts/backup-db.sh
# Variables : DATABASE_URL (obligatoire, lue aussi depuis .env s'il existe),
#             BACKUP_DIR (défaut ./backups), BACKUP_RETENTION_DAYS (défaut 7).
#
# Garanties : toute erreur (connexion, pg_dump, compression, archive vide ou tronquée) arrête le
# script avec un code non nul ; le fichier final n'apparaît qu'une fois l'archive vérifiée ;
# les anciennes sauvegardes ne sont purgées qu'après une sauvegarde réussie.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL est requis}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# libpq refuse les paramètres propres à Prisma (?schema=public) : on les retire
PG_URL="${DATABASE_URL%%\?*}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FINAL="$BACKUP_DIR/xnova_backup_${TIMESTAMP}.sql.gz"
TMP="$(mktemp "$BACKUP_DIR/.xnova_backup.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

# pipefail : un échec de pg_dump fait échouer toute la chaîne (pas d'archive « vide mais valide »)
pg_dump --no-owner --no-privileges --clean --if-exists "$PG_URL" | gzip -c > "$TMP"

# Vérifications : archive lisible, non vide, dump complet (pg_dump écrit cette ligne en dernier)
gzip -t "$TMP"
if ! gzip -dc "$TMP" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "ERREUR: sauvegarde incomplète (fin de dump absente)" >&2
  exit 1
fi

chmod 600 "$TMP"
mv "$TMP" "$FINAL"
trap - EXIT
echo "OK: sauvegarde créée et vérifiée : $FINAL ($(du -h "$FINAL" | cut -f1))"

# Rotation, seulement après succès
find "$BACKUP_DIR" -name 'xnova_backup_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "OK: sauvegardes de plus de ${RETENTION_DAYS} jours supprimées"
