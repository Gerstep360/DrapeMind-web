#!/usr/bin/env bash
set -euo pipefail
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$WEB_DIR/install.sh" --nginx "$@"
