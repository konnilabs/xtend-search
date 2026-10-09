# XTend.search 0.4.4 – Standalone Control Plane

Neu in 0.3.5: getrennte Web- und Wissensquellen, vollständige Quellenangaben bei gemeinsamen Treffern sowie konkrete Fehlermeldungen. [Update-Anleitung](xtend/docs/UPGRADE-0.3.5.md).

In 0.3.4: korrigierte Sprachabdeckung für Quellen mit SearXNG-Regionskatalog, insbesondere Bing-Bilder. [Update und Prüfung bestehender Freigaben](xtend/docs/UPGRADE-0.3.4.md).

In 0.3.3: wiederhergestelltes Favicon, bereinigte Navigation und About als XDialog mit barrierearmem Seiten-Fallback. [Update-Anleitung](xtend/docs/UPGRADE-0.3.3.md).

Aktuelles Frontend: **0.4.4**, Backend: **0.4.2**. Eine zentrale Wortmarke mit Header-Morphing, Logo-Fade und CCS-Shell: [Release](xtend/docs/RELEASE-0.4.4.md), [Update/Rollback](xtend/docs/UPGRADE-0.4.4.md). SSR-Attributkorrektur, kompakteres Resume-Wire und Capability-Abdeckung: [Patch und Abnahme](xtend/docs/RELEASE-0.4.1.md). Gespeicherte Suchfilter, explizite SafeSearch-Ausnahmen pro Quelle und immer sichtbare Wissenskarten: [Update und Bedienung](xtend/docs/UPGRADE-0.3.2.md).

Der aktuelle Entwicklungsstand verwendet einen eigenen XTend/Node-Container und einen privaten SearXNG-Container. Die neue Admin-Oberfläche liegt unter `/admin` und verwendet Nextclouds eingebautes OAuth2 mit expliziten Rollen. Quellen bleiben bis zur administrativen Freigabe gesperrt.

- Installation, SSO, Backup und Rollback: [CONTROL-PLANE-OPERATIONS.md](xtend/docs/CONTROL-PLANE-OPERATIONS.md)
- Abnahmestand und Grenzen: [CONTROL-PLANE-PROGRESS.md](xtend/docs/CONTROL-PLANE-PROGRESS.md)
- Framework-/MCP-Evidenz: [CONTROL-PLANE-ENGINEERING.md](xtend/docs/CONTROL-PLANE-ENGINEERING.md)
- Release und Messwerte: [CONTROL-PLANE-RELEASE.md](xtend/docs/CONTROL-PLANE-RELEASE.md)

```sh
node xtend/scripts/setup-control.mjs
# .env.control mit Nextcloud-Client und Rollenfreigabe vervollständigen
docker compose --env-file .env.control -f compose.control.yml up -d --build
```

Die folgenden Abschnitte beschreiben weiterhin die erhaltene kombinierte 0.2.1-Variante und ihren Rollbackpfad.

---

# XTend.search

Eine eigenständige Search-SPA mit **XTend/Maraca 0.8.0 Hydrangea**, serverseitigem HTML, signiertem Resume und SearXNG als unverändertem Suchkern. Eigenes XTend.search-Branding; der About-Bereich `/info/de/about` enthält **Powered by SearXNG**. Keine React-/Vue-Schicht.

**App-Version 0.2.1:** Das Suchfeld behält auf kleinen Bildschirmen seine Schriftgröße von 16 px; die bisherige mobile Verkleinerung auf 14 px entfällt. Die Viewport-Einstellung erlaubt weiterhin manuelles Zoomen.

Seit **0.2.0**:  Resumierte Navigationen erhalten erste Ergebnisse über den echten XScaler-Adapter und Maraca-AppService-Streamframes. Initiale Dokumentanfragen behalten vollständiges SSR. Details, Tests und der Schalter `XTEND_STREAMING=0` stehen in [XSCALER-STREAMING.md](xtend/docs/XSCALER-STREAMING.md).

## Start mit Docker

Benötigt Docker Engine und Compose. Alle Befehle im Wurzelordner dieses Projekts:

```sh
docker compose -f compose.xtend.yml up --build -d
```

Dann **http://localhost:8080** öffnen. Der Standard verwendet echte Suchquellen. Der erste Build lädt Basisimages und Python-/Node-Abhängigkeiten. Das exakte lokale XTend-Paket ist unter `xtend/vendor-inputs/` enthalten; auf dem Zielserver wird keine XTend-Entwicklungsumgebung benötigt.

```sh
docker compose -f compose.xtend.yml ps
docker compose -f compose.xtend.yml logs --tail 60
curl --fail http://localhost:8080/health/ready
docker compose -f compose.xtend.yml down
```

Compose bindet absichtlich an `127.0.0.1`. Mit `XTEND_PORT=8090` kann ein anderer lokaler Port gewählt werden. Falls eine frisch eingerichtete Docker-Gruppenmitgliedschaft in einer bestehenden Sitzung noch nicht aktiv ist: neu anmelden oder den Befehl in einer Sitzung mit aktivierter Docker-Gruppe ausführen.

## Reproduzierbarer Testmodus

```sh
XTEND_TEST_FIXTURE=1 XTEND_PORT=8090 docker compose -p xtend-search-test -f compose.xtend.yml up -d
```

Der Testmodus zeigt einen sichtbaren Hinweis und verwendet ausschließlich lokale Testdaten. `empty` liefert keine Treffer, `error` einen Enginefehler, `slow …` eine verzögerte Antwort und `benchmark50` 50 Texttreffer. `media` ergänzt eine Wissenskarte; mit der Kategorie Bilder liefert es sechs Bildtreffer, `media only` ausschließlich eine Karte. Die Bildadressen liegen auf einer reservierten Testdomain; `tests/media.mjs` ersetzt ausschließlich deren Bildproxy-Antworten durch lokale SVG-Motive. Die Such- und SSR-/Resume-Pfade laufen weiterhin real. **Kein Testmodus wird automatisch als Live-Suche ausgegeben.** Für parallelen Live- und Testbetrieb verschiedene Compose-Projektnamen verwenden.

## Linux-Server

Das gesamte Projekt inklusive `xtend/vendor-inputs/` auf einen Linux-Server übertragen und denselben Compose-Befehl verwenden. Für einen Browser auf einem anderen Rechner HTTPS über den vorhandenen Reverse Proxy bereitstellen; ein Caddy-Beispiel liegt unter `xtend/config/Caddyfile.example`.

```sh
PUBLIC_BASE_URL=https://search.example.com docker compose -f compose.xtend.yml up --build -d
```

Die Instanz ist als private MVP-Installation ausgelegt. Vor öffentlichem Betrieb Authentifizierung bzw. Rate-Limits am Proxy und SearXNG-Limiter/Valkey konfigurieren; der private Standard aktiviert diese nicht. `TRUSTED_PROXY_IPS` nur auf tatsächliche direkte Proxy-Adressen setzen. Suchbegriffe stehen in URLs; keine vollständigen Request-URLs in Proxy-Logs aufnehmen. Auf Servern sind ausgehendes HTTPS und vertrauenswürdige CA-Zertifikate erforderlich. Externe Engines können Captchas, Timeouts oder Teilausfälle liefern.

## Bedienung

- Suchfeld, Web/Bilder (auch als Vorwahl auf der Startseite), Sprache, Zeitraum, SafeSearch und Seitennavigation.
- Wissenskarten mit Beschreibung, Fakten, Quellen und verwandten Suchen, sofern die Suchquellen Infoboxen liefern.
- Bildvorschau als breites Seitenpanel: Klick aufs Bild, Pfeiltasten oder Vor/Zurück zum Blättern, Escape zum Schließen. Auf kleinen Bildschirmen steht die Vorschau über dem Raster. Originale werden erst beim Öffnen über den Bildproxy geladen. Ohne JavaScript führen die Bildlinks direkt zum Original.
- Klick auf das große Sidebar-Bild öffnet die XTend-XLightbox mit allen Bildern der aktuellen Ergebnisseite. Vor/Zurück, Pfeiltasten oder Wischen blättern im Kreis; Escape kehrt zur Sidebar zurück. Die Lightbox wird erst bei Bedarf geladen.
- Die Suchoberfläche folgt automatisch dem Hell-/Dunkel-Farbschema des Browsers bzw. Systems, auch ohne JavaScript.
- Erfolgreiche interne Navigation erhält das Dokument und die Shell. Zurück/Vorwärts stellt den URL-Zustand wieder her.
- Kein JavaScript nötig für normale Suche und Filter: echte GET-Formulare und Links.
- Der Klassiker unter `/classic/` bleibt nutzbar. Dessen Einstellungen gelten nur dort; die XTend-Ansicht verwendet ihre URL-Filter.
- `FRONTEND_MODE=classic` schaltet auch die Hauptrouten auf den gebrandeten Python-Fallback. Zur Rückkehr Variable entfernen oder `xtend` setzen und Compose erneut starten.
- `/source.tar.gz` liefert im Container den zugehörigen Quellstand einschließlich Build-Dateien und lokalem XTend-Paket.

## Entwicklung ohne Container

Node 24.19.0 (mindestens 24.18), npm 11.17.0 und Python 3.12 verwenden. SearXNGs Python-Abhängigkeiten sowie Granian stehen vollständig in `xtend/requirements.lock.txt`.

```sh
python3 -m venv .venv
.venv/bin/pip install -r xtend/requirements.lock.txt
cd xtend
npm ci --ignore-scripts
npm run build
cd ..
XTEND_PYTHON="$PWD/.venv/bin/python" node xtend/server/supervisor.mjs
```

Für lokale Fixtures zusätzlich `XTEND_TEST_FIXTURE=1` setzen. Der Supervisor erzeugt eigene Schlüssel in `xtend/.secrets/`; sie gehören nie in Git oder ein Release. Im Container liegen sie im Volume `search-secrets`. Eine Änderung/Rotation erfordert einen Neustart, aber keinen Frontend-Build. Löschen des Volumes erzeugt neue Schlüssel und macht alte Resume-Signaturen ungültig.

## Tests und Leistungsprüfung

Gegen eine laufende Fixture-Instanz:

```sh
cd xtend
npm ci --ignore-scripts
npx playwright install chromium firefox
npm test
TEST_BASE_URL=http://localhost:8090 npm run test:browser
TEST_BASE_URL=http://localhost:8090 node tests/shell-regressions.mjs
TEST_BASE_URL=http://localhost:8090 node tests/media.mjs
TEST_BASE_URL=http://localhost:8090 node tests/lightbox.mjs
TEST_BASE_URL=http://localhost:8090 node tests/streaming.mjs
```

`tests/benchmark.mjs` benötigt zusätzlich einen separaten SearXNG-Upstream mit identischer Fixture-Engine hinter vergleichbarer Kompression (`BASELINE_URL`). Es erzeugt Messreihen mit 5 Warm-ups und 30 Wiederholungen, Kalt-/Warmcache und Desktop-/gedrosseltem Profil. Details, Grenzen und Ergebnisse: `xtend/docs/IMPLEMENTATION.md`, `xtend/docs/VERIFICATION.md`, `xtend/docs/MEDIA-SURFACES.md`, `xtend/docs/LIGHTBOX.md`, `xtend/evidence/`.

Das Produkt ist ein funktionaler MVP und zugleich eine Leistungsprüfung. **Aktueller Befund für 0.2.0:** XScaler-Streaming wurde lokal im Docker-Livebetrieb geprüft; 21 Streamingprüfungen, 79 Regressionen und zehn Unitprüfungen sind bestanden. Der initiale JS-Graph benötigt 450,4 KiB gzip (Ziel: 150 KiB), der nachgeladene Streamadapter weitere 2,8 KiB. Erste Webtreffer waren in einer Live-Stichprobe nach 0,93 Sekunden verfügbar, der Suchlauf endete nach rund 5,5 Sekunden. Dies belegt frühe Teilergebnisse, keine allgemeine Performancefreigabe oder Produktions-SLA. Initial-SSR, das große Basisbundle und die ältere Upstream-Vergleichsreihe bleiben getrennte Prüfbereiche. Architektur, Messgrenzen und Nachweise: [XSCALER-STREAMING.md](xtend/docs/XSCALER-STREAMING.md).

## Lizenzen

SearXNG und die Integration: AGPL-3.0-or-later, siehe `LICENSE`. XTend: Apache-2.0, Lizenz im mitgelieferten Paket. Ursprüngliche Copyright- und Lizenzhinweise bleiben erhalten. XTend.search ist kein offizielles SearXNG-Produkt.

### Schließbare Suchhinweise

Quellenfehler und die Begrenzung auf 100 Treffer erscheinen als XTend-XAlerts mit Schließen-Button. Geschlossene Hinweise bleiben für die aktuelle Antwort ausgeblendet; eine neue Suche zeigt deren Hinweise wieder. Ohne JavaScript bleiben die Texte lesbar. Integrations- und Testnachweise: `xtend/docs/ALERTS.md`.

### Nicht verfügbare Bilder

Nicht ladbare Trefferbilder werden durch einen lokalen Platzhalter ersetzt. Sidebar und Vollbildansicht erlauben auch nach Bildfehlern weiteres Blättern. Eine neue Suche versucht die Quellen erneut. Der ursprüngliche Netzwerkfehler kann weiterhin in den Entwicklerwerkzeugen erscheinen; Zugriffsbeschränkungen werden nicht umgangen. Details: `xtend/docs/IMAGE-FALLBACK.md`.
