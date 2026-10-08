#!/usr/bin/env bash
# Mise à jour d’une installation existante Ubuntu / LXC avec systemd.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  cat <<'HELP'
Mise à jour XNova sans réinstallation :
  sudo bash scripts/update.sh            Mettre à jour depuis origin/main
  sudo bash scripts/update.sh --check    Vérifier et afficher la version disponible
Les sauvegardes sont conservées dans backups/update-*/ (base et configuration).
Le code doit être sur main, propre, et correspondre aux services xnova-api/web.
Une erreur après modification du code garde les services arrêtés : aucun reset
ni restauration automatique de la base n’est effectué.
HELP
  exit 0
fi
[[ $# == 0 || ( $# == 1 && "$1" == --check ) ]] || { echo 'Options : --help, --check' >&2; exit 2; }
[[ "$EUID" == 0 ]] || { echo 'Lancer avec sudo : sudo bash scripts/update.sh' >&2; exit 1; }
command -v node >/dev/null
command -v flock >/dev/null
# Verrou commun aux mises à jour du serveur ; libéré même après une interruption.
exec flock --nonblock --conflict-exit-code 75 /run/lock/xnova-update.lock node "$ROOT/scripts/update/update.mjs" "$@"
