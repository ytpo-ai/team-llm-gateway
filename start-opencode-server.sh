#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4096}"
HOSTNAME="${HOSTNAME:-127.0.0.1}"

if [ -n "${OPENCODE_SERVER_PASSWORD:-}" ]; then
  exec opencode serve --port "$PORT" --hostname "$HOSTNAME"
else
  echo "Warning: OPENCODE_SERVER_PASSWORD is not set, server runs without auth."
  exec opencode serve --port "$PORT" --hostname "$HOSTNAME"
fi
