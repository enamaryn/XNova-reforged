#!/bin/bash

# Configuration depuis .env
source "$(dirname "$0")/../.env"

# Verifier qu'un fichier de backup est fourni
if [ -z "$1" ]; then
  echo "Usage: ./restore-db.sh <backup_file.sql.gz>"
  echo "Backups disponibles:"
  ls -lh "$(dirname "$0")/../backups/"
  exit 1
fi

BACKUP_FILE=$1

# Verifier que le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERREUR: Fichier non trouve: $BACKUP_FILE"
  exit 1
fi

# Extraire les informations de connexion
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Decompresser et restaurer
export PGPASSWORD="$DB_PASS"

echo "ATTENTION: Cette operation va ECRASER la base de donnees actuelle."
read -p "Voulez-vous continuer? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restauration annulee"
  exit 0
fi

# Decompresser si necessaire
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
else
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

if [ $? -eq 0 ]; then
  echo "OK: Restauration reussie depuis: $BACKUP_FILE"
else
  echo "ERREUR: Echec lors de la restauration"
  exit 1
fi
