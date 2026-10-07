#!/usr/bin/env bash
# Vérifie qu'une installation (serveur de production, clone) correspond au package-lock.json :
# version de Node, arbre de dépendances cohérent, paquets clés à la version verrouillée.
# À lancer après `npm ci` et avant `npm run build` / redémarrage des services.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 2
FAIL=0
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

NODE_V="$(node -v | sed 's/^v//')"
node -e '
const [maj, min] = process.argv[1].split(".").map(Number);
const ok = (maj === 20 && min >= 19) || (maj === 22 && min >= 12) || maj >= 23;
process.exit(ok ? 0 : 1);
' "$NODE_V" && pass "Node $NODE_V (>= 20.19 ou >= 22.12)" || fail "Node $NODE_V trop ancien (>= 20.19 ou >= 22.12 requis)"

if npm ls --all >/dev/null 2>&1; then
  pass "arbre de dépendances cohérent (npm ls)"
else
  fail "npm ls signale des erreurs : lancer « npm ci » (sans --ignore-scripts) à la racine"
fi

# Paquets dont la version installée doit être celle du lockfile
for PKG in @sentry/nextjs @sentry/node next; do
  LOCKED="$(node -e '
    const lock = require("./package-lock.json").packages;
    const e = lock["node_modules/" + process.argv[1]];
    console.log(e ? e.version : "");
  ' "$PKG")"
  INSTALLED="$(node -e '
    try { console.log(require(process.argv[1] + "/package.json").version); } catch (e) { console.log(""); }
  ' "$PKG")"
  if [ -n "$LOCKED" ] && [ "$LOCKED" = "$INSTALLED" ]; then
    pass "$PKG $INSTALLED (identique au lockfile)"
  else
    fail "$PKG : installé « ${INSTALLED:-absent} », verrouillé « ${LOCKED:-absent} » : lancer « npm ci »"
  fi
done

# Client Prisma généré : sans lui l'API plante au démarrage (« Cannot convert undefined or null to object » dans IsEnum)
if node -e '
const c = require("@prisma/client");
process.exit(c.UserRole && Object.keys(c.UserRole).length > 0 ? 0 : 1);
' >/dev/null 2>&1; then
  pass "client Prisma généré (enums disponibles)"
else
  fail "client Prisma absent ou périmé : lancer « npx prisma generate --schema packages/database/prisma/schema.prisma »"
fi

[ "$FAIL" = "0" ] && echo "RÉSULTAT : installation conforme au lockfile" || { echo "RÉSULTAT : $FAIL contrôle(s) en échec"; exit 1; }
