#!/bin/sh
# Independent of live containers, host ports, data volumes and OAuth secrets.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$script_dir/../../.." && pwd)
image=${1:-xtend-search-searxng:upstream-contract}
cd "$repo_dir"
if [ -n "${XTEND_BUILD_NETWORK:-}" ]; then set -- --network "$XTEND_BUILD_NETWORK"; else set --; fi
docker build "$@" -f Dockerfile.searxng -t "$image" .
docker run --rm --network none --read-only --tmpfs /tmp \
  --tmpfs /var/lib/xtend-backend:uid=10001,gid=10001 \
  --cap-drop ALL --security-opt no-new-privileges \
  -e PYTHONPATH=/app -e SEARXNG_TOKEN=fixture-test-only \
  -e SEARXNG_SECRET=fixture-secret -e XTEND_TEST_FIXTURE=1 \
  -e SEARXNG_SETTINGS_PATH=/app/xtend/config/settings.control.fixture.yml \
  -v "$repo_dir/xtend/tests/control/upstream_contract.py:/app/upstream_contract.py:ro" \
  --entrypoint python "$image" /app/upstream_contract.py
