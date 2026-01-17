#!/bin/bash
# Script de lancement des tests E2E XNova Reforged
# Usage: ./scripts/run-e2e-tests.sh [options]
#
# Options:
#   --headed      Lancer avec navigateur visible
#   --debug       Mode debug interactif
#   --ui          Interface graphique Playwright
#   --report      Ouvrir le rapport après les tests
#   --file <nom>  Lancer un fichier de test spécifique (ex: auth, buildings)

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   XNova Reforged - Tests E2E${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Répertoire racine du projet
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Options par défaut
HEADED=""
DEBUG=""
UI=""
REPORT=""
FILE=""

# Parser les arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headed)
      HEADED="--headed"
      shift
      ;;
    --debug)
      DEBUG="--debug"
      shift
      ;;
    --ui)
      UI="--ui"
      shift
      ;;
    --report)
      REPORT="yes"
      shift
      ;;
    --file)
      FILE="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Option inconnue: $1${NC}"
      exit 1
      ;;
  esac
done

# Vérifier que Docker est lancé
echo -e "${YELLOW}Vérification de Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Docker n'est pas lancé. Démarrez Docker et réessayez.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker OK${NC}"

# Vérifier que les conteneurs sont actifs
echo -e "${YELLOW}Vérification des services (PostgreSQL, Redis)...${NC}"
if ! docker compose ps | grep -q "running"; then
  echo -e "${YELLOW}Démarrage des services Docker...${NC}"
  npm run docker:up
  sleep 5
fi
echo -e "${GREEN}✓ Services OK${NC}"

# Vérifier Playwright
echo -e "${YELLOW}Vérification de Playwright Chromium...${NC}"
if ! npx playwright install --dry-run chromium > /dev/null 2>&1; then
  echo -e "${YELLOW}Installation de Chromium...${NC}"
  npx playwright install chromium
fi
echo -e "${GREEN}✓ Playwright OK${NC}"

echo ""
echo -e "${BLUE}Lancement des tests...${NC}"
echo ""

# Construire la commande
CMD="npx playwright test --project=chromium"

if [[ -n "$FILE" ]]; then
  CMD="$CMD tests/e2e/${FILE}.spec.ts"
fi

if [[ -n "$HEADED" ]]; then
  CMD="$CMD $HEADED"
fi

if [[ -n "$DEBUG" ]]; then
  CMD="$CMD $DEBUG"
fi

if [[ -n "$UI" ]]; then
  CMD="$CMD $UI"
fi

# Exécuter les tests
echo -e "${YELLOW}Commande: $CMD${NC}"
echo ""

$CMD

# Afficher le rapport si demandé
if [[ "$REPORT" == "yes" ]]; then
  echo ""
  echo -e "${BLUE}Ouverture du rapport...${NC}"
  npx playwright show-report
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Tests terminés !${NC}"
echo -e "${GREEN}========================================${NC}"
