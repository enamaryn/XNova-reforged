#!/bin/bash
# Installation des dependances systeme Playwright + Chromium.

set -euo pipefail

echo "========================================"
echo "   Playwright - dependances systeme"
echo "========================================"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "npx est requis. Installez Node.js/NPM puis reessayez."
  exit 1
fi

OS_NAME="$(uname -s)"
DISTRO_ID="unknown"
DISTRO_LIKE=""
if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO_ID="${ID:-unknown}"
  DISTRO_LIKE="${ID_LIKE:-}"
fi

SUDO_PREFIX=()
if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO_PREFIX=(sudo env "PATH=$PATH")
  else
    echo "sudo est requis pour installer les dependances systeme."
    exit 1
  fi
fi

is_debian_like() {
  [[ "$DISTRO_ID" =~ ^(debian|ubuntu|linuxmint|pop|elementary)$ ]] || [[ "$DISTRO_LIKE" == *"debian"* ]]
}

is_fedora_like() {
  [[ "$DISTRO_ID" =~ ^(fedora|rhel|centos|rocky|almalinux)$ ]] || [[ "$DISTRO_LIKE" == *"rhel"* ]] || [[ "$DISTRO_LIKE" == *"fedora"* ]]
}

install_deps_debian() {
  echo "Installation des dependances systeme via Playwright (apt)..."
  "${SUDO_PREFIX[@]}" npx playwright install-deps chromium
}

install_deps_fedora() {
  local packages=(
    alsa-lib
    at-spi2-atk
    at-spi2-core
    atk
    cairo
    cups-libs
    dbus-libs
    fontconfig
    freetype
    glib2
    gtk3
    libdrm
    libX11
    libX11-xcb
    libXcomposite
    libXcursor
    libXdamage
    libXext
    libXfixes
    libXi
    libXrandr
    libXrender
    libXScrnSaver
    libXtst
    libxcb
    libxkbcommon
    libxkbcommon-x11
    libxshmfence
    mesa-libEGL
    mesa-libGL
    mesa-libgbm
    nspr
    nss
    pango
    libjpeg-turbo
    libpng
    libwebp
    liberation-fonts
    xorg-x11-fonts-100dpi
    xorg-x11-fonts-75dpi
    xorg-x11-fonts-cyrillic
    xorg-x11-fonts-misc
    xorg-x11-fonts-Type1
    xorg-x11-utils
  )

  if command -v dnf >/dev/null 2>&1; then
    echo "Installation des dependances systeme via dnf..."
    "${SUDO_PREFIX[@]}" dnf install -y "${packages[@]}"
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    echo "Installation des dependances systeme via yum..."
    "${SUDO_PREFIX[@]}" yum install -y "${packages[@]}"
    return
  fi

  echo "dnf/yum introuvable. Installez les dependances manuellement."
  exit 1
}

case "$OS_NAME" in
  Linux)
    echo "OS detecte: Linux ($DISTRO_ID)"
    if is_debian_like; then
      install_deps_debian
    elif is_fedora_like; then
      install_deps_fedora
    else
      echo "Distribution non prise en charge automatiquement."
      if command -v apt-get >/dev/null 2>&1; then
        install_deps_debian
      else
        echo "Veuillez installer les dependances Chromium manuellement."
      fi
    fi
    ;;
  Darwin)
    echo "OS detecte: macOS"
    echo "Les dependances systeme sont gerees par macOS. Installation sautee."
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "OS detecte: Windows"
    echo "Ce script bash est destine a Linux/macOS. Utilisez PowerShell pour Windows."
    exit 1
    ;;
  *)
    echo "OS non supporte: $OS_NAME"
    exit 1
    ;;
esac

echo ""
echo "Installation du navigateur Chromium..."
npx playwright install chromium

echo ""
echo "OK - dependances Playwright installees."
