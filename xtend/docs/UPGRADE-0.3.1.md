# XTend.search 0.3.1 – Admin-Oberfläche aktualisieren

Das Produktions-Image `2076769f1ee1…` aus dem ursprünglichen 0.3.0-Archiv stammt
von vor den lokalen Admin-Korrekturen. Die schmale Darstellung ist dadurch beim
Deployment wieder sichtbar geworden. Dieser Export enthält den korrigierten Stand
unter einem neuen Tag, damit alte und neue Images eindeutig unterscheidbar sind.

Enthalten sind die volle Dashboardbreite, korrekt umbrechende Listeneinträge,
Kategorie-/Namensfilter, Capability-Hilfe, Scroll-Erhalt, XToasts sowie die
korrigierten Standardvorschläge für Anbietergruppen und verständlichere Suchfehler.
Admin-Dateien werden mit `private, no-store` ausgeliefert. Die Version wird in
der Fußzeile, über `/health/ready` und als HTTP-Header ausgegeben.

## Vorhandene 0.3.0-Installation aktualisieren

1. `XTend-search-Docker-Image-0.3.1-linux-amd64.tar.gz` auf den Docker-Host laden.
   Dies ist ein direkt mit Docker ladbares **Frontend-Image**, kein verschachteltes
   Installationspaket. Das vorhandene Backend `xtend-search-searxng:0.3.0` bleibt
   erhalten.
2. Im Verzeichnis mit Image und Prüfsummendatei prüfen und importieren:

   ```sh
   sha256sum -c XTend-search-Docker-Image-0.3.1-linux-amd64.tar.gz.sha256
   docker load -i XTend-search-Docker-Image-0.3.1-linux-amd64.tar.gz
   ```

3. In **Portainer → Stacks → vorhandener XTend-Stack** entweder die neue
   `XTend-search-0.3.1-Portainer.compose.yml` verwenden oder im vorhandenen YAML
   nur das Image des Dienstes `search` auf `xtend-search:0.3.1` ändern.
   **Wenn `XTEND_SEARCH_IMAGE` als Stack-Variable gesetzt ist, diese ebenfalls
   auf `xtend-search:0.3.1` ändern**; sie überschreibt den Standardwert im YAML.
   Beim SearXNG-Dienst bleibt das Image `xtend-search-searxng:0.3.0`.
4. Alle bestehenden Auth-Variablen, Port, Domain und insbesondere die Namen von
   `XTEND_CONTROL_VOLUME` und `XTEND_BACKEND_VOLUME` unverändert übernehmen.
   Den bestehenden Stack aktualisieren, keinen zweiten Stack auf denselben
   Volumes starten. **Re-pull image / Pull latest image deaktiviert lassen**;
   das importierte lokale Image soll verwendet werden.
5. Stack aktualisieren und warten, bis beide Container gesund sind. Danach prüfen:

   ```sh
   curl --fail http://127.0.0.1:8090/health/ready
   ```

   Bei abweichendem `XTEND_PORT` diesen Port verwenden. Die Antwort muss
   `"version":"0.3.1"` enthalten. Auch der produktive HTTPS-Aufruf von
   `/health/ready` muss 0.3.1 melden. Die Image-ID in Portainer mit `IMAGE-ID.txt`
   vergleichen, falls die Version noch 0.3.0 lautet.
6. Admin-Seite neu laden und erneut über Nextcloud anmelden. Bei einem zusätzlich
   konfigurierten Proxy-Cache dessen alte Admin-Antworten entfernen und `/admin`
   sowie `/assets/xtend/admin/` von diesem Cache ausschließen.

Gespeicherte Freigaben und Budgets bleiben unverändert; es gibt keine automatische
Policy-Migration. Falls die bestehende Installation unterschiedliche Anbieter
noch unter `shared` zusammenfasst, diese Zuordnung im Admin-Bereich prüfen.
Aktive Schutzfristen nicht durch Umbenennen umgehen. Die frühere, speziell
geprüfte lokale DuckDuckGo-Reparatur wird auf dem Produktionsserver **nicht**
automatisch ausgeführt.

## Rückkehr zum vorherigen Image

Das bisherige 0.3.0-Image vorerst behalten. Falls nötig den vorhandenen Stack
wieder auf dieses Image setzen; Volumes nicht löschen oder auf ältere Backups
zurücksetzen. 0.3.1 verwendet das unveränderte Control-Plane-Datenschema.
Der Download allein aktualisiert den Server nicht; der Imageimport und das
Neuerstellen des Containers im bestehenden Stack sind erforderlich.
