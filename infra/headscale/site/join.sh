#!/bin/sh
# adiabatic.garden/join — one-time setup for a new pear.
#
#   curl -fsSL https://adiabatic.garden/join | sh -s -- [invite code]
#
# Installs Tailscale when an invite is given, clones the repo into
# ~/.feynman/prism, installs the torrent, and hands over to `pnpm join`,
# which logs into the tailnet, asks for a username and launches the pear.
set -eu

INVITE="${1:-}"
FEYNMAN_HOME="${FEYNMAN_HOME:-$HOME/.feynman}"
REPO="${FEYNMAN_REPO:-https://github.com/TuringsBazaar/feynmans-prism.git}"
PRISM="$FEYNMAN_HOME/prism"

need() { command -v "$1" >/dev/null 2>&1; }

if [ -n "$INVITE" ] && ! need tailscale; then
  echo "installing tailscale"
  curl -fsSL https://tailscale.com/install.sh | sh
fi
need git || { echo "git is required"; exit 1; }
need node && node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' \
  || { echo "Node.js >= 22 is required: https://nodejs.org"; exit 1; }
need pnpm || corepack enable pnpm 2>/dev/null || npm install -g pnpm

mkdir -p "$FEYNMAN_HOME"
if [ -d "$PRISM/.git" ]; then git -C "$PRISM" pull -q --ff-only
else git clone -q "$REPO" "$PRISM"
fi
pnpm -C "$PRISM/torrent" install --silent

if [ -n "$INVITE" ]; then exec pnpm -C "$PRISM/torrent" join -- --invite "$INVITE"
else exec pnpm -C "$PRISM/torrent" join
fi
