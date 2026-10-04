#!/usr/bin/env bash
# Restauration d'une sauvegarde PostgreSQL, tout ou rien (OPS-01).
#
# Usage : scripts/restore-db.sh [--yes] <sauvegarde.sql.gz> [URL_BASE_CIBLE]
#
# Cible : URL_BASE_CIBLE, sinon RESTORE_DATABASE_URL, sinon DATABASE_URL.
# Pour un test de restauration, utiliser une base ISOLÉE (jamais celle des joueurs).
#
# Garanties : l'archive est vérifiée avant toute écriture ; la restauration s'exécute dans UNE
# transaction avec arrêt à la première erreur SQL : en cas d'échec, la base cible reste inchangée
# et le script sort avec un code non nul. Le dump contient DROP ... IF EXISTS : la restauration
# remplace les objets existants de la cible.
set -euo pipefail

ASSUME_YES=0
if [ "${1:-}" = "--yes" ]; then
  ASSUME_YES=1
  shift
fi

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 [--yes] <sauvegarde.sql.gz> [URL_BASE_CIBLE]" >&2
  exit 2
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERREUR: fichier introuvable : $BACKUP_FILE" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

TARGET_URL="${2:-${RESTORE_DATABASE_URL:-${DATABASE_URL:-}}}"
if [ -z "$TARGET_URL" ]; then
  echo "ERREUR: aucune base cible (argument, RESTORE_DATABASE_URL ou DATABASE_URL)" >&2
  exit 2
fi
PG_URL="${TARGET_URL%%\?*}"

# Archive vérifiée avant d'écrire quoi que ce soit
if ! gzip -t "$BACKUP_FILE"; then
  echo "ERREUR: archive corrompue : $BACKUP_FILE" >&2
  exit 1
fi

# Dump complet ? (pg_dump écrit cette ligne en dernier ; une archive tronquée mais valide serait
# sinon restaurée à moitié)
if ! gzip -dc "$BACKUP_FILE" | tail -n 5 | grep -q "PostgreSQL database dump complete"; then
  echo "ERREUR: sauvegarde incomplète (fin de dump absente) : $BACKUP_FILE" >&2
  exit 1
fi

# Affichage de la cible sans mot de passe
SAFE_TARGET="$(echo "$PG_URL" | sed -E 's#(://[^:/@]*):[^@]*@#\1:***@#')"
echo "Cible de la restauration : $SAFE_TARGET"

if [ "$ASSUME_YES" -ne 1 ]; then
  echo "ATTENTION: cette opération remplace les données de la base cible."
  if [ ! -t 0 ]; then
    echo "ERREUR: confirmation impossible sans terminal ; utiliser --yes explicitement" >&2
    exit 1
  fi
  read -r -p "Continuer ? (yes/no) : " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Restauration annulée"
    exit 0
  fi
fi

# pipefail + ON_ERROR_STOP + transaction unique : la moindre erreur annule tout
gzip -dc "$BACKUP_FILE" | psql -v ON_ERROR_STOP=1 --single-transaction --quiet --file=- "$PG_URL" > /dev/null

echo "OK: restauration réussie depuis $BACKUP_FILE"
