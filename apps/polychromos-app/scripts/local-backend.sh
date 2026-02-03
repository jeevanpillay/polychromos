#!/usr/bin/env bash
set -euo pipefail

# Convex local backend configuration - can be overridden via environment
BACKEND_PORT="${CONVEX_BACKEND_PORT:-3210}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
ADMIN_KEY="${CONVEX_ADMIN_KEY:-0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

case "${1:-}" in
  run)
    cd "$APP_DIR"
    if [ ! -x ./convex-local-backend ]; then
      if [ "$(uname)" = "Darwin" ]; then
        if [ "$(uname -m)" = "arm64" ]; then
          pkg=convex-local-backend-aarch64-apple-darwin.zip
        elif [ "$(uname -m)" = "x86_64" ]; then
          pkg=convex-local-backend-x86_64-apple-darwin.zip
        fi
      elif [ "$(uname -m)" = "x86_64" ]; then
        pkg=convex-local-backend-x86_64-unknown-linux-gnu.zip
      fi
      echo "Downloading Convex local backend: $pkg"
      curl -L -O "https://github.com/get-convex/convex-backend/releases/latest/download/$pkg"
      unzip "$pkg"
      rm "$pkg"
    fi
    exec ./convex-local-backend --port "$BACKEND_PORT"
    ;;
  reset)
    cd "$APP_DIR"
    rm -rf convex_local_storage convex_local_backend.sqlite3
    ;;
  convex)
    shift
    npx convex "$@" --admin-key "$ADMIN_KEY" --url "$BACKEND_URL"
    ;;
  *)
    echo "Usage: $0 {run|reset|convex <args>}"
    echo ""
    echo "Commands:"
    echo "  run     Download (if needed) and run the Convex local backend"
    echo "  reset   Delete local Convex data"
    echo "  convex  Run convex CLI against local backend (pass additional args)"
    exit 1
    ;;
esac
