#!/bin/bash

# Configuration depuis .env
source "$(dirname "$0")/../.env"

# Variables
BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/xnova_backup_$TIMESTAMP.sql"

# Creer le repertoire de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Extraire les informations de connexion depuis DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Executer le backup
export PGPASSWORD="$DB_PASS"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Verifier le succes
if [ $? -eq 0 ]; then
  echo "OK: Backup cree avec succes: $BACKUP_FILE"

  # Compresser le backup
  gzip "$BACKUP_FILE"
  echo "OK: Backup compresse: ${BACKUP_FILE}.gz"

  # Supprimer les backups de plus de 7 jours
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
  echo "OK: Anciens backups supprimes (>7 jours)"
else
  echo "ERREUR: Echec lors du backup"
  exit 1
fi
