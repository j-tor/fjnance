#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
command -v node >/dev/null 2>&1 || { echo 'Se requiere Node.js 22 o superior.' >&2; exit 1; }
exec node scripts/verificar.mjs "$@"
