# XTend.search 0.4.1 – Update von 0.4.0

Dieses Patch-Release ersetzt ausschließlich das Frontend. Backend `xtend-search-searxng:0.4.0`, vorhandene Volumes, Ports, Nextcloud-Konfiguration und Backend-Token weiterverwenden.

## Docker / Portainer

1. Bestehende Datenvolumes sichern; Stackname und Volume-Zuordnung beibehalten.
2. Das neue Frontend-Archiv auf den Docker-Host übertragen und prüfen:

   ```sh
   sha256sum -c XTend-search-Docker-Image-0.4.1-linux-amd64.tar.gz.sha256
   docker load -i XTend-search-Docker-Image-0.4.1-linux-amd64.tar.gz
   docker image inspect xtend-search:0.4.1 --format '{{.Id}}'
   ```

3. Image-ID mit `XTend-search-0.4.1-IMAGE-ID.txt` vergleichen.
4. Im bestehenden Portainer-Stack das Frontend auf `xtend-search:0.4.1` setzen. Eine vorhandene `XTEND_SEARCH_IMAGE`-Stackvariable entsprechend ändern; sie überschreibt den Compose-Default. Die beiliegende Compose nutzt `pull_policy: never`. Backend bleibt `xtend-search-searxng:0.4.0`.
5. Stack aktualisieren. `/health/ready` muss Version `0.4.1`, Speicher `ready` und Retrieval `compatible` melden. Nach Neustart ist eine neue Admin-Anmeldung erforderlich.
6. Startseite frisch laden: Suchfeld ist `type="search"`; Suche, Streaming, Filter, Bildvorschau und Dashboard prüfen.

Ein neuer Server benötigt zusätzlich das bereits ausgelieferte Backend-0.4.0-Archiv. Das Patch-Paket enthält keine echten Env-Werte, privaten Schlüssel oder Datenvolumes. Host-Reverse-Proxy und dessen Streaming-Einstellungen beibehalten. Für abweichende Hostports weiter `XTEND_PORT` setzen.

## Lokaler Build

```sh
docker build --network=host -f Dockerfile.control -t xtend-search:0.4.1 .
docker compose --env-file .env.control -f compose.control.yml up -d --no-build --no-deps search
```

Der SDK-Overlay wird vor dem Maraca-Build geprüft und angewendet. Bei SDK-Drift bricht der Build ab; Hash-Prüfungen nicht umgehen. Allgemeine Hinweise zu SSO, Belegvolume, Qualitätsregeln und Backend siehe `UPGRADE-0.4.0.md`.

## Rollback auf 0.4.0

Frontend wieder auf `xtend-search:0.4.0` setzen und neu anlegen. Backend und alle Volumes unverändert lassen. Es gibt keine Schemaänderung zwischen 0.4.0 und 0.4.1; aktive Qualitätsfristen bleiben im vorhandenen Store erhalten. Der Rückweg reaktiviert die bekannten SSR-/Payload-Probleme des alten Frontends.
