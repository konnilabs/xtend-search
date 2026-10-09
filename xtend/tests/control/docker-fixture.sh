#!/bin/sh
# Run as a Docker-authorized user from the repository root. No live credentials.
set -eu
fixture_image=${FIXTURE_IMAGE:-xtend-search:0.4.2}
fixture_settings=${FIXTURE_SETTINGS:-xtend/config/settings.control.fixture.yml}
fixture_data=${FIXTURE_DATA_VOLUME:-xtend-cp-fixture-data}
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
cd "$repo_dir"
docker network inspect xtend-cp-fixture-net >/dev/null 2>&1 || docker network create xtend-cp-fixture-net >/dev/null
for name in xtend-cp-oauth-test xtend-cp-search-test xtend-cp-backend-test; do
 if docker container inspect "$name" >/dev/null 2>&1; then docker rm -f "$name" >/dev/null; fi
done
docker run -d --name xtend-cp-backend-test --network xtend-cp-fixture-net --network-alias searxng \
 -p 127.0.0.1:8092:8082 --read-only --tmpfs /tmp --tmpfs /var/lib/xtend-backend:uid=10001,gid=10001 \
 -v "$PWD/$fixture_settings:/app/xtend/config/settings.control.fixture.yml:ro" \
 --cap-drop ALL --security-opt no-new-privileges \
 -e SEARXNG_TOKEN=fixture-test-only -e XTEND_TEST_FIXTURE=1 \
 -e SEARXNG_SETTINGS_PATH=/app/xtend/config/settings.control.fixture.yml xtend-search-searxng:0.4.2 >/dev/null
# Start the frontend only after the private backend passes its health endpoint.
backend_ready=0
for attempt in $(seq 1 30); do
 if docker exec xtend-cp-backend-test python -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8082/healthz",timeout=1)' >/dev/null 2>&1; then backend_ready=1; break; fi
 sleep 1
done
if [ "$backend_ready" != 1 ]; then docker logs --tail 30 xtend-cp-backend-test; exit 1; fi
if [ "${FIXTURE_SOURCE:-0}" = 1 ]; then set -- -v "$PWD/xtend:/app/xtend:ro"; else set --; fi
docker run "$@" -d --name xtend-cp-search-test --network xtend-cp-fixture-net \
 -p 127.0.0.1:8096:8080 -p 127.0.0.1:8094:8094 --read-only --tmpfs /tmp \
 --cap-drop ALL --security-opt no-new-privileges -v "$fixture_data:/var/lib/xtend-search" --tmpfs /var/lib/xtend-evidence:uid=10001,gid=10001 \
 -e PUBLIC_BASE_URL=http://localhost:8093 -e SEARXNG_BASE_URL=http://searxng:8082/ -e SEARXNG_TOKEN=fixture-test-only \
 -e NEXTCLOUD_BASE_URL=http://localhost:8094 -e NEXTCLOUD_CLIENT_ID=fixture -e NEXTCLOUD_CLIENT_SECRET=fixture-only \
 -e 'XTEND_ADMIN_ROLES={"administrator":"administrator","operator":"operator","viewer":"viewer"}' \
 -e XTEND_PROBES=1 -e XTEND_TEST_FIXTURE=1 "$fixture_image" >/dev/null
docker run -d --name xtend-cp-oauth-test --network container:xtend-cp-search-test --read-only --cap-drop ALL \
 -e FIXTURE_BIND=0.0.0.0 --entrypoint node "$fixture_image" xtend/tests/control/oauth-fixture.mjs >/dev/null
printf '%s\n' 'Fixtures started. Run proxy-fixture.mjs, then browser.mjs and edge-browser.mjs.'
