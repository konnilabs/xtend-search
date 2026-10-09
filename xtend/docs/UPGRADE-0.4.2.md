# XTend.search 0.4.2 – gepaartes Update

Frontend **0.4.2** und erweitertes SearXNG-Backend **0.4.2** gemeinsam verwenden. Kein Update durch Austausch gegen ein unverändertes offizielles SearXNG-Image. Vorhandene Nextcloud-Env-Konfiguration, Backend-Token, Hostports, Stackname und drei Datenvolumes beibehalten.

## Docker / Portainer

1. Control-, Backend- und Belegvolume sichern. Für die laufende SQLite-Datenbank einen konsistenten Backupmechanismus verwenden oder den Stack für die Dateikopie stoppen. Datenbanken und Signing-Keys nicht veröffentlichen.
2. Beide Archive samt Prüfsummen auf den Docker-Host übertragen:

   ```sh
   sha256sum -c XTend-search-Docker-Image-0.4.2-linux-amd64.tar.gz.sha256
   sha256sum -c XTend-search-SearXNG-Image-0.4.2-linux-amd64.tar.gz.sha256
   docker load -i XTend-search-Docker-Image-0.4.2-linux-amd64.tar.gz
   docker load -i XTend-search-SearXNG-Image-0.4.2-linux-amd64.tar.gz
   docker image inspect xtend-search:0.4.2 --format '{{.Id}}'
   docker image inspect xtend-search-searxng:0.4.2 --format '{{.Id}}'
   ```

3. IDs mit den beiden beiliegenden IMAGE-ID-Dateien vergleichen. Im bestehenden Portainer-Stack `XTEND_SEARCH_IMAGE=xtend-search:0.4.2` und `XTEND_BACKEND_IMAGE=xtend-search-searxng:0.4.2` setzen oder die neuen Defaults nutzen. Vorhandene Stackvariablen überschreiben Defaults. `pull_policy: never` verwendet die geladenen Images.
4. Stack aktualisieren. `/health/ready` muss Version `0.4.2`, Speicher `ready` und Retrieval `compatible` melden. Frisch anmelden; SSO-Callback bleibt `${PUBLIC_BASE_URL}/admin/oauth/callback`.
5. Quellenstatus prüfen: Bei geänderten Capability-Fingerprints erst Katalog/Provider prüfen und dann gezielt erneut freigeben. Keine pauschale Freigabe, kein Löschen von Guards. Insbesondere Bildquellen `artic`, `devicons`, `flickr`, `lucide` haben neue Upstream-Defaults.
6. Sprachwechsel und Moduswechsel, Streaming, drei Webquellen plus Knowledge, Preview/XLightbox und den neuen CCS-Login prüfen. Vorhandene Filter-Cookies funktionieren weiter.

Der Reverse-Proxy läuft auf dem Host. Das Paket veröffentlicht standardmäßig nur `127.0.0.1:${XTEND_PORT:-8090}`. Existierende HTTPS-/Streaming-Proxykonfiguration weiterverwenden; SearXNG bleibt im privaten Compose-Netz ohne Hostport. In einem Testsystem mit Portkonflikt `XTEND_PORT` und `PUBLIC_BASE_URL` passend setzen und den OAuth-Callback entsprechend registrieren.

## Reproduzierbarer Build

```sh
node xtend/scripts/check-searxng.mjs
docker build --network=host -f Dockerfile.searxng -t xtend-search-searxng:0.4.2 .
docker build --network=host -f Dockerfile.control -t xtend-search:0.4.2 .
docker compose --env-file .env.control -f compose.control.yml up -d --no-build
```

`--network=host` war auf dem lokalen Rechner für Paketdownloads nötig; bei normal funktionierendem Docker-Buildnetz kann es entfallen. SDK- und Core-Hash-Gates nicht umgehen. Neue Docker-Tags nie still mit einem anderen Release ersetzen.

## Rollback auf 0.4.1

**Beide** Images zurücksetzen: Frontend `xtend-search:0.4.1`, Backend `xtend-search-searxng:0.4.0`. Die Core-Attestierung verhindert absichtlich gemischte alte/neue Paare. Stack und Volumes beibehalten; keine Schemaänderung. Technische Schutzfristen, Qualitätsregeln und Qualitätspausen bleiben bestehen. Neue Freigaben mit anderen Katalog-Fingerprints müssen auch beim Rückweg geprüft werden; ein Image-Rollback ist keine Freigabe.

Nur wenn gespeicherte Daten selbst zurückgesetzt werden müssen, die ausdrücklich ausgewählte Sicherung bei gestopptem Stack wiederherstellen. Ein Backup-Restore verliert alle seit der Sicherung vorgenommenen Änderungen und ist kein normaler Image-Rollback.
