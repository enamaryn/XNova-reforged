#!/usr/bin/env bash
# Point d'entrée sans dépendances npm, pour un clone neuf sur Ubuntu 24.04.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ " ${*} " == *" --help "* || " ${*} " == *" -h "* ]]; then
  cat <<'HELP'
Assistant web d'installation initiale XNova (Ubuntu 24.04 / systemd)
  sudo bash scripts/install.sh
Le navigateur demande le mode, l'adresse web, la base locale/externe et le HTTPS.
Un code d'accès temporaire et les adresses web s'affichent dans le terminal.
Ouvrez http://ADRESSE_IP_DU_SERVEUR:3000 depuis votre ordinateur.
Pour limiter l'écoute à un proxy local ou un tunnel SSH :
  sudo env XNOVA_BOOTSTRAP_HOST=127.0.0.1 bash scripts/install.sh
Une relance reprend la configuration créée par cet installateur sans renouveler
les mots de passe ni effacer la base. Aucun paquet npm n'est requis pour la page.
HELP
  exit 0
fi

[[ $# == 0 ]] || { echo "Options disponibles : --help" >&2; exit 1; }
[[ "$EUID" == 0 ]] || { echo "L'installation système demande root : sudo bash scripts/install.sh" >&2; exit 1; }
# shellcheck disable=SC1091
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || {
  echo "Installateur système pris en charge : Ubuntu 24.04 (y compris LXC avec systemd)." >&2; exit 1;
}
[[ -d /run/systemd/system ]] || { echo "systemd doit être actif." >&2; exit 1; }
if ! command -v node >/dev/null || ! command -v npm >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=23?0:1)' ; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -d -m 755 /etc/apt/keyrings
    KEY_FILE="$(mktemp)"
    trap 'rm -f "$KEY_FILE"' EXIT
    curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 \
      https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o "$KEY_FILE"
    gpg --batch --yes --dearmor -o /etc/apt/keyrings/xnova-nodesource.gpg "$KEY_FILE"
    chmod 644 /etc/apt/keyrings/xnova-nodesource.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/xnova-nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
      > /etc/apt/sources.list.d/xnova-nodesource.list
    apt-get update
    apt-get install -y nodejs
    rm -f "$KEY_FILE"
    trap - EXIT
fi
exec node "$ROOT/scripts/install/install.mjs" "$@"
