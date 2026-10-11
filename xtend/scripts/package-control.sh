#!/bin/sh
# Versioned paired frontend/backend export. Does not publish or deploy.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec node "$root/xtend/scripts/package-v05.mjs" "$@"
