# XTend.search 0.5.0 — Browser-Ressourcen, Knowledge und Wiederanlauf

Search-PR: https://github.com/konnilabs/xtend-search/pull/13.

Status: Release-Kandidat; Merge, Framework-Publishing und Produktionsdeployment sind eigene Schritte. Frontend und privates Backend tragen beide **0.5.0**. Der SearXNG-Pin bleibt `9f042d2f67666f86204d6874488880a23ba81a8f` / `2026.10.9+9f042d2f6`.

## Framework-Abhängigkeit

Framework-PR: https://github.com/konnilabs/xtend/pull/110, Basis `d4912deb30fe8d85d8e442e34d74ec6050f0fe09`, SDK-Head `dd1917bfeb8f173dde585f743a866c1b0d38e9f1`. Das SDK wurde lokal per npm pack gebaut; es ist keine veröffentlichte npm-Version. `xtend/vendor-inputs/xtend-0.9.0-provenance.json` enthält den SHA-256 des Artefakts, das Lockfile dessen npm-Integrität.

Search verwendet den generischen `createPageResourceCache` und PageClients optionale `resourceCache`-Policy über deklarierte Maraca App Services. Im Framework sind keine Providerregeln enthalten. Der alte 0.8-SSR-Overlay ist entfernt; beide Page-Builds aktivieren den offiziellen `xtend.page-initial-resume.v1`-Vertrag. Der XLightbox-Controls-Slot bleibt eine explizite, gegen 0.9 geprüfte Build-Erweiterung ohne SDK-Dateimutationen.

## Browser-Cache und Datenschutz

`XTEND_SEARCH_CACHE=1` aktiviert die Wiederverwendung beim Moduswechsel und bei Back/Forward. Suchbutton, Enter und Filter-Anwenden nutzen `reload` und entfernen den Zieleintrag. Der Framework-Cache enthält höchstens zehn JSON-Ressourcen / 8 MiB, abgeschlossene Suchen höchstens zehn Minuten, gültig-leere Suchen 60 Sekunden. Lesen verlängert die Frist nicht. Ergebnisse mit einzelnen Quellenfehlern sind zulässig, Fehleransichten und Teilstreams sind ausgeschlossen.

Schlüssel enthalten den exakten Suchbegriff, Modus, Sprache, Zeitraum, SafeSearch, Seite, signierte Fortsetzung, Framework-Kontext und serverseitige Epoche. Vor Wiederverwendung fragt `search.cache.context` ausschließlich Backend-Metadaten ab; ein Treffer startet weder Page-Abfrage noch Suchstream oder Provider-Dispatch. Änderungen der Freigaben, des Katalogs oder der Frontend-/Backend-Instanz verwerfen Ressourcen. Ausfall der Metadatenprüfung führt zur normalen Navigation.

Der Cache besteht ausschließlich im RAM des Tabs. Reload, PageClient-Invalidierung und Disposal verwerfen ihn. Keine Suchsessions auf dem Server, keine Suchergebnisse in Local Storage, Session Storage oder history.state. Die vorhandene freiwillige Filterpersistenz bleibt separat. Keine Bilddateien, DOM, Resume-Envelopes, Zugangsdaten oder CSRF-Token werden gecacht. Ergebnisse enthalten weiterhin kurzlebige signierte Melde-/Medien-/Fortsetzungsaktionen; die Cache-Frist endet mindestens 30 Sekunden vor der konservativ frühesten Aktionsfrist, einschließlich Favicon-Tagesgrenze.

## Knowledge

Geprüfte Registry: Wikipedia und Wikidata (`wikimedia`), `ddg definitions` (`duckduckgo`). Neue Knowledge-Capabilities bleiben gesperrt, bis ein Administrator sie im Observatory ausdrücklich freigibt. DDG ist auf `all` und englische Suchsprache begrenzt; die Card und Quelle erläutern die begrenzte Sprachsteuerung. SafeSearch bleibt wirksam; fehlende Providerunterstützung verlangt weiterhin die explizite Admin-Ausnahme mit öffentlichem Hinweis.

Drei normale Quellen plus ein Knowledge-Platz; Knowledge belegt keinen normalen Ergebnisplatz. Ein RAM-Zähler rotiert zwischen verfügbaren Familien und dann Engines. Bei leerer, mehrdeutiger oder fehlerhafter Antwort erfolgt höchstens ein Fallback, vorzugsweise aus einer anderen Familie. Insgesamt höchstens fünf Dispatches, zwölf Sekunden Laufzeit, Fallback-Start vor Sekunde zehn. Gemeinsame Schutzfristen bleiben verbindlich. Eine eindeutig verwertbare Card wird ausgeklappt dargestellt; normale Treffer und Cards werden separat gezählt.

Nur Knowledge entfernt den Zeitraum. Aktiver Zeitraum wird sichtbar als „Zeitlose Zusatzinformationen – unabhängig vom gewählten Zeitraum“ erklärt. Diagnosen unterscheiden Freigabe, Filter, Schutzfrist, leere Antwort, Mehrdeutigkeit und technischen Fehler.

## Native Fristen und Recovery

Der authentifizierte private `engine-health-v1`-Adapter liest SearXNGs vorhandenen Sperrzustand, ohne eine Suche auszulösen. Monotone Backend-Uhrwerte werden als verbleibende Millisekunden übertragen. Instanzkennung, Engine-IDs, tatsächlicher gemeinsamer Sperrbereich, Gründe und Dauer werden geprüft. Neue Fehler verwenden native Fristen, Retry-After und lokale Schutzregeln; die 15-Tage-CAPTCHA-Schätzung bleibt ein gekennzeichneter Fallback. Bestehende persistierte Schätzungen werden nicht verkürzt.

`XTEND_DEMAND_RECOVERY=1` erlaubt nach Ablauf sämtlicher Fristen der nächsten passenden echten Suche einen atomar reservierten Wiederanlauf. Genau eine Lease wird vor Dispatch gespeichert. Eine schema- und sicherheitskonforme leere Antwort schließt den technischen Breaker ebenfalls. Abbruch öffnet den Breaker wieder; nach Neustart blockiert eine verwaiste Lease nur bis zu ihrem Ablauf. Administrative Sperren, Quarantäne, Qualitäts- und gemeinsame Providersperren bleiben bestehen. Funktioniert mit `XTEND_PROBES=0`; keine zusätzlichen Hintergrundsuchen werden eingeführt.

Das Observatory trennt Freigabe, aktuelle Verfügbarkeit, Fristgrund/-ende und Wiederanlauf. „Freigegeben“ bedeutet ausdrücklich nicht „jetzt nutzbar“.

## Upgrade / Portainer

1. Bisherige Image-IDs und Stack-Konfiguration sichern. Schreibzugriff stoppen; **Control-, Backend- und Belegvolume** vor dem Upgrade vollständig sichern. Die private Env-Datei separat schützen. Keine Sicherung und kein Secret gehört in Git oder Release-Archive.
2. `SHA256SUMS` prüfen. `load.sh` lädt beide enthaltenen Docker-Archive. Alternativ einzeln `docker load -i XTend-search-Docker-Image-0.5.0-linux-amd64.tar.gz` und `docker load -i XTend-search-SearXNG-Image-0.5.0-linux-amd64.tar.gz` ausführen. `IMAGE-IDS.txt` mit Docker/Portainer vergleichen.
3. `compose.portainer.yml` als Stack verwenden. `XTEND_SEARCH_IMAGE=xtend-search:0.5.0`, `XTEND_BACKEND_IMAGE=xtend-search-searxng:0.5.0`. **`SEARXNG_IMAGE` allein ersetzt nicht den modifizierten Adapter.** Ein generisches Upstream-SearXNG-Image ist nicht vertragskompatibel. Interner Suchkern bleibt über `SEARXNG_BASE_URL` erreichbar.
4. Bisherige Volume-Namen, SSO-Client-ID/-Secret, genaue Nextcloud-Rollen und externe Callback-URL unverändert übernehmen. `SEARXNG_TOKEN` ist ein eigener interner Schlüssel; beide Services müssen denselben Wert erhalten. `PUBLIC_BASE_URL` entspricht der externen HTTPS-Adresse. Host-Proxy erreicht die nur auf Loopback gebundene Frontend-Portfreigabe; bei Konflikten `XTEND_PORT` ändern.
5. Feature-Schalter können zunächst beide `0` sein und getrennt aktiviert werden. Keine automatische Freigabe für neue Capabilities. Health-Readiness, SSO, bestehende Grants, Filter, drei Webquellen plus Card und Mode-Cache lokal prüfen.

Der Single-Owner-Lock und bestehende additive SQLite-Tabellen bleiben. Neue Recovery-Guard-Felder sind additive Daten. Ein Rollback verwendet **vorherige Images plus den gesicherten vorherigen Datenstand**; neue Guard-Daten werden nicht ungeprüft mit 0.4.4 betrieben. Nur das Deaktivieren eines Features ersetzt keinen Datenrollback.

## Reproduzierbare Gates / Nachweise

Node 24.19 / npm 11.17. Framework: Der abschließende vollständige ci-pr-Lauf auf dem gepinnten Head bestand **189/189 Gruppen**, ohne Fehler oder Skips, mit 53 dokumentierten Inventar-Warnungen. SSR/PageClient, Browser-Lifecycle, App Services, Paketexports und Strict-Beispiel sind nachgewiesen. Der frühere Transportlauf mit 188/189, seine Schema-Reparatur und der aktualisierte MCP-Dokumentationsindex werden als getrennte Nachweise aufbewahrt. MCP-Vertrags- und Paketprüfungen per CLI bestehen ebenfalls. Cache-Modul: 1.009 Byte gzip. SDK-Migrationskosten werden separat vom Cache-Modul gemessen.

Search: `npm --prefix xtend ci --ignore-scripts`, `npm --prefix xtend run build:control`, `npm --prefix xtend run test:control`. Private Python-Verträge: `XTEND_BUILD_NETWORK=host sh xtend/tests/control/upstream-gate.sh xtend-search-searxng:0.5.0`. Builds auf diesem Rechner benötigen Docker-Build-Netzwerk `host`, weil die BuildKit-Bridge keine externen Pakete erreicht.

Offline-Fixturnetz mit synthetischem OAuth, gesonderten Volumes und deaktivierten Probes: `FIXTURE_DATA_VOLUME=xtend-cp-v05-data FIXTURE_PROBES=0 FIXTURE_SETTINGS=xtend/config/settings.control.v05.fixture.yml sh xtend/tests/control/docker-fixture.sh`, danach `proxy-fixture.mjs`, `cache-browser.mjs` und übrige Browser-Gates **nacheinander**. Gleichzeitige Browserläufe würden die gezielt gemessenen Providerzähler und Budgets beeinflussen.

`0.5.0-baseline.json`, `0.5.0-performance.json`, `0.5.0-cache-browser.json` und Regression-Berichte im Verification-Archiv liefern die konkreten Ergebnisse. Performance: gleiche 100/700/2500-ms-Fixtures, zehn frische Browserkontexte, erster sichtbarer Treffer, Streamabschluss, Cache-Metadaten-/Renderzeit, JS-Transport und Cache-RAM getrennt. Frischer erster Paint darf im Median nicht mehr als zehn Prozent zurückfallen. Das ist ein lokaler reproduzierbarer Vergleich, keine Messung produktiver Providerlatenz.

Zu Beginn wurde nach callable XTend-MCP-Werkzeugen gesucht; kein XTend-MCP-Connector war exponiert. Framework-/Search-Implementierung, Strict-Builds und Gates sind **SDK-/CLI-Nachweise**, keine behaupteten MCP-Interaktionen. `0.5.0-engineering.json` protokolliert Vertragsentscheidungen und relevante Befunde ohne Suchbegriffe, Ergebnislinks oder Secrets. Der Framework-PR und der Search-PR dokumentieren die Abhängigkeit und sind separat reviewbar.

Der About-Dialog wurde zusätzlich in der lokalen Docker-Instanz mit dem In-App-Browser geprüft: Nach dem JavaScript-Start öffnet der Shell-Link ein XDialog ohne Seitennavigation; Schließen stellt den Fokus wieder her. Direkte Links und No-JS behalten die lesbare separate Fallback-Seite.
