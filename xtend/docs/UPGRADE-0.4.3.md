# XTend.search 0.4.3 – Frontend-Patch

Frontend **0.4.3** mit erweitertem Backend **0.4.2** verwenden. Das SearXNG-Core-Update aus [0.4.2](UPGRADE-0.4.2.md) bleibt Grundlage. Keine Datenmigration; Stackname, Volumes und Env-Konfiguration weiterverwenden.

```sh
sha256sum -c XTend-search-Docker-Image-0.4.3-linux-amd64.tar.gz.sha256
docker load -i XTend-search-Docker-Image-0.4.3-linux-amd64.tar.gz
docker image inspect xtend-search:0.4.3 --format '{{.Id}}'
```

Image-ID mit `XTend-search-0.4.3-IMAGE-ID.txt` vergleichen. Im bestehenden Portainer-Stack `XTEND_SEARCH_IMAGE=xtend-search:0.4.3` und `XTEND_BACKEND_IMAGE=xtend-search-searxng:0.4.2` nutzen. Das neue Portainer-Paket enthält die passende Compose und eine auszufüllende Env-Vorlage; bestehende echte Zugangsdaten nicht durch die Vorlage ersetzen. `pull_policy: never` verwendet das geladene Image.

Nach dem Update muss `/health/ready` Version `0.4.3`, Speicher `ready` und Retrieval `compatible` melden. Startseite frisch laden: zentrierte Suche, transparente obere Leiste, keine entfernten Marketingtexte. Suche absenden und Rücknavigation prüfen. Bei reduzierter Bewegung erfolgt der Layoutwechsel sofort.

Lokaler Build und Neustart nur des Frontends:

```sh
docker build --network=host -f Dockerfile.control -t xtend-search:0.4.3 .
docker compose --env-file .env.control -f compose.control.yml up -d --no-build --no-deps search
```

Rollback dieses UI-Patches: Frontend zurück auf `xtend-search:0.4.2`, Backend bleibt `xtend-search-searxng:0.4.2`. Volumes beibehalten. Ein Rückweg auf Frontend 0.4.1 benötigt zusätzlich das damalige Backend 0.4.0; siehe die gepaarte Rollback-Anleitung für 0.4.2.
