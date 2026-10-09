# XTend.search 0.4.4 – Frontend-Patch

Frontend **0.4.4** mit erweitertem Backend **0.4.2** verwenden. Keine Backendänderung oder Datenmigration. Stackname, Volumes und bestehende Env-Konfiguration weiterverwenden.

```sh
sha256sum -c XTend-search-Docker-Image-0.4.4-linux-amd64.tar.gz.sha256
docker load -i XTend-search-Docker-Image-0.4.4-linux-amd64.tar.gz
docker image inspect xtend-search:0.4.4 --format '{{.Id}}'
```

Die Image-ID mit `XTend-search-0.4.4-IMAGE-ID.txt` vergleichen. Im bestehenden Portainer-Stack `XTEND_SEARCH_IMAGE=xtend-search:0.4.4` setzen. `XTEND_BACKEND_IMAGE=xtend-search-searxng:0.4.2` beibehalten. Das Portainer-Paket enthält Compose und eine auszufüllende Env-Vorlage; echte Zugangsdaten nicht mit der Vorlage ersetzen. `pull_policy: never` nutzt das bereits geladene Image. Bei einem erstmaligen Update von 0.4.1 oder älter auch [das gepaarte Backend-Update](UPGRADE-0.4.2.md) durchführen.

`/health/ready` muss Version `0.4.4`, Speicher `ready` und Retrieval `compatible` melden. Danach die Seite einmal frisch laden: Auf der Startseite nur eine zentrale Wortmarke und kein kleines Branding oben links. Suche absenden, Wortmarkenbewegung und Logo-/Header-Fade beobachten; Zurück/Vorwärts prüfen. Bei reduzierter Bewegung erscheint das fertige Layout sofort.

Lokaler Build und Neustart ausschließlich des Frontends:

```sh
docker build --network=host -f Dockerfile.control -t xtend-search:0.4.4 .
docker compose --env-file .env.control -f compose.control.yml up -d --no-build --no-deps search
```

Rollback: Frontend auf `xtend-search:0.4.3` zurücksetzen, Backend bleibt `xtend-search-searxng:0.4.2`. Volumes beibehalten. Frühere gepaarte Rückwege sind in der 0.4.2-Anleitung beschrieben.
