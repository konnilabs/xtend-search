#!/bin/bash
# Creates a self-contained release from already built and tested images.
set -euo pipefail
release_version=0.3.0
repo_root=$(cd "$(dirname "$0")/../.." && pwd)
output_dir=$(dirname "$repo_root")
release_name="XTend-search-Install-${release_version}-linux-amd64"
release_dir="$output_dir/$release_name"
mkdir -p "$release_dir"
cd "$repo_root"
python3 - "$release_dir" <<'PY'
import pathlib,sys
out=pathlib.Path(sys.argv[1])
s=pathlib.Path('compose.control.yml').read_text().splitlines()
# Release uses prebuilt images; retain the original source Compose in source.tar.gz.
result=[];skip=False
for line in s:
 if line=='    build:': skip=True;continue
 if skip and line.startswith('      '):continue
 skip=False;result.append(line)
(out/'compose.control.yml').write_text('\n'.join(result)+'\n')
PY
cp xtend/docs/CONTROL-PLANE-OPERATIONS.md "$release_dir/INSTALLATION.md"
cp xtend/docs/CONTROL-PLANE-RELEASE.md "$release_dir/RELEASE-NOTES.md"
cp xtend/docs/CONTROL-PLANE-ENGINEERING.md "$release_dir/ENGINEERING.md"
cp xtend/docs/CONTROL-PLANE-PROGRESS.md "$release_dir/ACCEPTANCE.md"
cp xtend/scripts/prepare-release-control.mjs "$release_dir/setup.mjs"
cp LICENSE "$release_dir/LICENSE"
evidence_files=(local-runtime.json release-images.txt admin-nojs.json unit.log legacy-unit.log browser.json edge-browser.json paint.json performance.json deployment.json isolation.log nextcloud-verification.json mcp-admin-compile.json mcp-search-compile.json build.json admin-desktop.png admin-mobile.png search-streamed.png)
evidence_paths=(); for item in "${evidence_files[@]}"; do evidence_paths+=("xtend/evidence/control-plane/$item"); done
tar -czf "$release_dir/xtend-search-0.3.0-verification.tar.gz" "${evidence_paths[@]}" xtend/evidence/mcp
cat > "$release_dir/prepare.sh" <<'SCRIPT'
#!/bin/sh
set -eu
cd "$(dirname "$0")"
sha256sum -c SHA256SUMS
docker load -i XTend-search-Docker-Images-0.3.0-linux-amd64.tar.gz
docker run --rm --network none --user "$(id -u):$(id -g)" \
 -v "$PWD:/install" -w /install --entrypoint node xtend-search:0.3.0 /install/setup.mjs
printf '%s\n' 'Anschließend .env.control bearbeiten und Compose gemäß INSTALLATION.md starten.'
SCRIPT
chmod +x "$release_dir/prepare.sh"
docker save xtend-search:0.3.0 xtend-search-searxng:0.3.0 | gzip -1 > "$release_dir/XTend-search-Docker-Images-0.3.0-linux-amd64.tar.gz"
source_container=$(docker create xtend-search:0.3.0)
trap 'docker rm "$source_container" >/dev/null 2>&1 || true' EXIT
docker cp "$source_container:/app/source.tar.gz" "$release_dir/xtend-search-0.3.0-source.tar.gz"
docker rm "$source_container" >/dev/null
trap - EXIT
docker image inspect xtend-search:0.3.0 xtend-search-searxng:0.3.0 --format '{{.RepoTags}} {{.Id}} {{.Architecture}}' > "$release_dir/IMAGE-IDS.txt"
(cd "$release_dir" && sha256sum compose.control.yml setup.mjs prepare.sh INSTALLATION.md RELEASE-NOTES.md ENGINEERING.md ACCEPTANCE.md LICENSE IMAGE-IDS.txt *.tar.gz > SHA256SUMS)
release_files=(compose.control.yml setup.mjs prepare.sh INSTALLATION.md RELEASE-NOTES.md ENGINEERING.md ACCEPTANCE.md LICENSE IMAGE-IDS.txt SHA256SUMS XTend-search-Docker-Images-0.3.0-linux-amd64.tar.gz xtend-search-0.3.0-source.tar.gz xtend-search-0.3.0-verification.tar.gz)
release_paths=(); for item in "${release_files[@]}"; do release_paths+=("$release_name/$item"); done
tar -czf "$output_dir/$release_name.tar.gz" -C "$output_dir" "${release_paths[@]}"
(cd "$output_dir" && sha256sum "$release_name.tar.gz" > "$release_name.sha256")
printf '%s\n' "$output_dir/$release_name.tar.gz"
