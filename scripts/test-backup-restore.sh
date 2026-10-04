#!/usr/bin/env bash
# Test de sauvegarde, restauration, échecs et retour arrière sur des bases ISOLÉES (OPS-01).
#
# Usage : TEST_PG_ADMIN_URL=postgresql://user:pass@hote:port/postgres scripts/test-backup-restore.sh
#
# Crée deux bases jetables (jamais la base des joueurs), applique les migrations versionnées,
# insère des données, sauvegarde, restaure, vérifie les données, provoque des échecs (archive
# corrompue, tronquée, SQL invalide, source injoignable, absence de confirmation) et répète le
# retour arrière d'une migration par restauration. Les bases sont supprimées en fin de test.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${TEST_PG_ADMIN_URL:-postgresql://postgres@localhost:5432/postgres}"
BASE_URL="${ADMIN_URL%/*}"
SUFFIX="$$_$RANDOM"
SRC_DB="xnova_bk_src_$SUFFIX"
DST_DB="xnova_bk_dst_$SUFFIX"
LEG_DB="xnova_bk_leg_$SUFFIX"
SRC_URL="$BASE_URL/$SRC_DB"
DST_URL="$BASE_URL/$DST_DB"
WORK="$(mktemp -d)"
SCHEMA="$ROOT/packages/database/prisma/schema.prisma"
FAILS=0

cleanup() {
  psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$SRC_DB\"" >/dev/null 2>&1 || true
  psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$DST_DB\"" >/dev/null 2>&1 || true
  psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$LEG_DB\"" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAILS=$((FAILS + 1)); }
expect_ok() { local name="$1"; shift; if "$@" >"$WORK/out.log" 2>&1; then pass "$name"; else fail "$name"; sed 's/^/        /' "$WORK/out.log" | tail -5; fi; }
expect_fail() { local name="$1"; shift; if "$@" >"$WORK/out.log" 2>&1; then fail "$name (aurait dû échouer)"; else pass "$name"; fi; }
sql() { psql -X -At "$1" -c "$2"; }
# Empreinte du contenu des tables métier : comptes + hachage des lignes
fingerprint() {
  sql "$1" "SELECT (SELECT count(*) FROM \"User\") || ':' || (SELECT count(*) FROM \"Planet\") || ':' || \
    md5(coalesce((SELECT string_agg(id || username || email, ',' ORDER BY id) FROM \"User\"), '') || \
        coalesce((SELECT string_agg(id || name || metal::text, ',' ORDER BY id) FROM \"Planet\"), ''))"
}

echo "== Préparation (bases isolées $SRC_DB / $DST_DB)"
psql "$ADMIN_URL" -qc "CREATE DATABASE \"$SRC_DB\"" || { echo "Impossible de créer la base source"; exit 2; }
psql "$ADMIN_URL" -qc "CREATE DATABASE \"$DST_DB\"" || { echo "Impossible de créer la base cible"; exit 2; }

echo "== Migrations versionnées sur base vierge"
expect_ok "prisma migrate deploy (base source)" env DATABASE_URL="$SRC_URL?schema=public" npx prisma migrate deploy --schema "$SCHEMA"
expect_ok "aucun écart entre migrations et schema.prisma" \
  env DATABASE_URL="$SRC_URL?schema=public" npx prisma migrate diff --from-url "$SRC_URL?schema=public" --to-schema-datamodel "$SCHEMA" --exit-code

echo "== Base existante créée par db push : alignement sur les migrations (baseline)"
psql "$ADMIN_URL" -qc "CREATE DATABASE \"$LEG_DB\"" || { echo "Impossible de créer la base historique"; exit 2; }
expect_ok "base historique créée par prisma db push" env DATABASE_URL="$BASE_URL/$LEG_DB?schema=public" npx prisma db push --skip-generate --schema "$SCHEMA"
expect_ok "baseline : migrate resolve --applied de la migration initiale" \
  env DATABASE_URL="$BASE_URL/$LEG_DB?schema=public" npx prisma migrate resolve --applied 20261004000000_init --schema "$SCHEMA"
expect_ok "base historique à jour pour migrate deploy (aucune migration en attente)" \
  env DATABASE_URL="$BASE_URL/$LEG_DB?schema=public" npx prisma migrate deploy --schema "$SCHEMA"

echo "== Données de test"
sql "$SRC_URL" "INSERT INTO \"User\"(id, username, email, password, \"updatedAt\") VALUES
  ('u1','alice','alice@test.local','h1', now()), ('u2','bob','bob@test.local','h2', now()), ('u3','carol','carol@test.local','h3', now())" >/dev/null
sql "$SRC_URL" "INSERT INTO \"Planet\"(id, \"userId\", name, galaxy, system, position, metal) VALUES
  ('p1','u1','Mère A',1,1,1,1234.5), ('p2','u2','Mère B',1,1,2,99.25), ('p3','u3','Mère C',2,5,7,0)" >/dev/null 2>"$WORK/seed.err" || { cat "$WORK/seed.err"; fail "insertion des planètes"; }
SRC_FP="$(fingerprint "$SRC_URL")"
echo "  empreinte source : $SRC_FP"

echo "== Sauvegarde"
export BACKUP_DIR="$WORK/backups"
expect_ok "backup-db.sh réussit" env DATABASE_URL="$SRC_URL?schema=public" "$ROOT/scripts/backup-db.sh"
BACKUP="$(ls "$BACKUP_DIR"/xnova_backup_*.sql.gz 2>/dev/null | head -1)"
[ -n "$BACKUP" ] && pass "archive produite ($(basename "$BACKUP"))" || { fail "archive absente"; exit 1; }
[ "$(stat -c %a "$BACKUP")" = "600" ] && pass "permissions 600" || fail "permissions de l'archive"
expect_ok "archive valide (gzip -t)" gzip -t "$BACKUP"
[ "$(ls -A "$BACKUP_DIR" | grep -c '^\.xnova_backup')" = "0" ] && pass "aucun fichier temporaire résiduel" || fail "fichier temporaire résiduel"

echo "== Restauration sur base isolée"
expect_ok "restore-db.sh --yes sur la base cible" "$ROOT/scripts/restore-db.sh" --yes "$BACKUP" "$DST_URL?schema=public"
DST_FP="$(fingerprint "$DST_URL")"
[ "$SRC_FP" = "$DST_FP" ] && pass "données identiques après restauration ($DST_FP)" || fail "données différentes (source $SRC_FP / cible $DST_FP)"
[ "$(sql "$DST_URL" 'SELECT count(*) FROM _prisma_migrations')" = "1" ] && pass "historique des migrations restauré" || fail "historique des migrations"

echo "== Échecs : la restauration est tout ou rien"
sql "$DST_URL" "INSERT INTO \"User\"(id, username, email, password, \"updatedAt\") VALUES ('u9','zoe','zoe@test.local','h9', now())" >/dev/null
MODIFIED_FP="$(fingerprint "$DST_URL")"

head -c 200 "$BACKUP" > "$WORK/corrompu.sql.gz"
expect_fail "archive corrompue refusée" "$ROOT/scripts/restore-db.sh" --yes "$WORK/corrompu.sql.gz" "$DST_URL"

gzip -dc "$BACKUP" | head -n 40 | gzip -c > "$WORK/tronque.sql.gz"
expect_fail "archive tronquée (gzip valide, dump incomplet) refusée" "$ROOT/scripts/restore-db.sh" --yes "$WORK/tronque.sql.gz" "$DST_URL"

{ gzip -dc "$BACKUP" | sed '$d'; echo 'SELECT * FROM table_inexistante;'; echo '-- PostgreSQL database dump complete'; } | gzip -c > "$WORK/invalide.sql.gz"
expect_fail "SQL invalide : restauration en échec" "$ROOT/scripts/restore-db.sh" --yes "$WORK/invalide.sql.gz" "$DST_URL"

[ "$(fingerprint "$DST_URL")" = "$MODIFIED_FP" ] && pass "base cible inchangée après les échecs (aucune restauration partielle)" || fail "base cible modifiée par une restauration échouée"

expect_fail "fichier inexistant refusé" "$ROOT/scripts/restore-db.sh" --yes "$WORK/absent.sql.gz" "$DST_URL"
expect_fail "sans --yes et sans terminal : refus" "$ROOT/scripts/restore-db.sh" "$BACKUP" "$DST_URL" < /dev/null
[ "$(fingerprint "$DST_URL")" = "$MODIFIED_FP" ] && pass "base cible inchangée sans confirmation" || fail "base cible modifiée sans confirmation"

BEFORE_COUNT="$(ls "$BACKUP_DIR" | wc -l)"
expect_fail "sauvegarde d'une base injoignable en échec" env DATABASE_URL="postgresql://postgres@127.0.0.1:1/inexistante" "$ROOT/scripts/backup-db.sh"
expect_fail "sauvegarde d'une base inexistante en échec" env DATABASE_URL="$BASE_URL/base_qui_nexiste_pas_$SUFFIX" "$ROOT/scripts/backup-db.sh"
[ "$(ls -A "$BACKUP_DIR" | wc -l)" = "$BEFORE_COUNT" ] && pass "aucune archive ni fichier temporaire créé par les sauvegardes en échec" || fail "résidus après sauvegarde en échec"

echo "== Retour arrière d'une migration par restauration"
# Migration jetable appliquée à la base source (copie du dossier prisma, jamais commitée)
PROBE="$WORK/prisma"
cp -r "$ROOT/packages/database/prisma" "$PROBE"
mkdir "$PROBE/migrations/20261005000000_sonde_retour_arriere"
echo 'ALTER TABLE "User" ADD COLUMN "sonde" TEXT;' > "$PROBE/migrations/20261005000000_sonde_retour_arriere/migration.sql"
expect_ok "migration de test appliquée (prisma migrate deploy)" env DATABASE_URL="$SRC_URL?schema=public" npx prisma migrate deploy --schema "$PROBE/schema.prisma"
[ "$(sql "$SRC_URL" "SELECT count(*) FROM information_schema.columns WHERE table_name='User' AND column_name='sonde'")" = "1" ] && pass "colonne ajoutée par la migration" || fail "migration non appliquée"
[ "$(sql "$SRC_URL" 'SELECT count(*) FROM _prisma_migrations')" = "2" ] && pass "deux migrations enregistrées" || fail "historique des migrations après migration"

expect_ok "retour arrière : restauration de la sauvegarde d'avant migration" "$ROOT/scripts/restore-db.sh" --yes "$BACKUP" "$SRC_URL"
[ "$(sql "$SRC_URL" "SELECT count(*) FROM information_schema.columns WHERE table_name='User' AND column_name='sonde'")" = "0" ] && pass "colonne retirée par le retour arrière" || fail "colonne toujours présente"
[ "$(sql "$SRC_URL" 'SELECT count(*) FROM _prisma_migrations')" = "1" ] && pass "historique revenu à une migration" || fail "historique après retour arrière"
[ "$(fingerprint "$SRC_URL")" = "$SRC_FP" ] && pass "données identiques à celles d'avant migration" || fail "données différentes après retour arrière"

echo
if [ "$FAILS" -eq 0 ]; then
  echo "RÉSULTAT : tous les contrôles ont réussi"
else
  echo "RÉSULTAT : $FAILS contrôle(s) en échec"
  exit 1
fi
