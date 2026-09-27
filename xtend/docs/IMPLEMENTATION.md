# XTend.search — Implementierungsentscheidungen

Datum: 19. September 2026. Implementierter MVP zur ADR-001-Leistungsprüfung. Dieses Dokument beschreibt den tatsächlich ausgeführten Pfad; das ursprüngliche ADR bleibt als Prüfauftrag erhalten.

## Herkunft und Zustand

- SearXNG wurde von `https://github.com/searxng/searxng.git` bezogen und auf `e831fc2a1cad50c9979b5f6f680376410218188c` fixiert. Auch der getrennte Upstream-Vergleich verwendet diesen Commit. Keine nachträgliche Aktualisierung während der Messungen.
- Lokales XTend: `/home/konni/Downloads/xtend-main/xtend`, Commit `d9d54cee532bcfd78f84e8c34471da9d05d9c431`, Version 0.8.0/Hydrangea. Der vorhandene Arbeitsstand enthielt bereits Änderungen, insbesondere am MCP. Er wurde nicht editiert. `evidence/provenance.json` hält den Dirty-Status und den SHA-256 des tatsächlich gepackten Archivs fest.
- Das 0.8.0-Archiv liegt in `vendor-inputs/ccslabs-xtend-0.8.0.tgz`; npm installiert exakt dieses Paket. Das bedeutet einen geprüften lokalen Snapshot, keine Behauptung über einen unveränderten öffentlichen Release.
- Node 24.19.0, npm 11.17.0; Python-Abhängigkeiten inklusive Granian exakt gepinnt. Basisimages sind per Digest fixiert. npm-Lockfile enthält Paketintegritäten.

## Komponenten und Eigentümerschaft

1. `server/gateway.mjs`: ein öffentlicher Port, Same-Origin-Routing, Kompression, Pfad-/Methoden-Allowlist, Größenlimits, Headerfilter und unabhängige Ausfallseite. Im Container laufen Core und Page-Host ausschließlich auf Loopback.
2. `server/core.py`: SearXNGs originale Flask-App über Granian/WSGI, zusätzlich unter `/classic` montiert. Suchparser, Engines, Plugins, Ranking und Resultcontainer bleiben upstream-eigen.
3. `server/host.mjs`: tatsächlicher `createNodePageHost` aus XTend. Löst native Routen auf, ruft den Python-Core einmal auf, rendert Maraca/RMT-SSR und signiert den Resume-Envelope mit ECDSA P-256/SHA-256.
4. `frontend/search.rmt`: RMT-Quelle für Shell und Ergebnis-Surface. Native Formulare, Links, Selects und Details. Modelländerungen, Projektionen, Resume und DOM-Abgleiche gehören XTend/Maraca.
5. `frontend/host.mjs`: kleine Integration für Ladeanzeige, nicht abgesendeten Suchentwurf und Tastaturfokus. Verwendet XTend-Commands; keine eigene Ergebnis-HTML-Erzeugung und kein zweiter Router.
6. `server/supervisor.mjs`: startet drei Prozesse, erzeugt instanzspezifische Geheimnisse und begrenzt Neustartversuche. Tini übernimmt PID 1 im Container.

## Suchvertrag und Core-Patch

`searx/webapp.py` erhält lediglich eine optionale Anreicherung **nach** `SearchWithPlugins.search()` und dem normalen JSON-Serializer. Nur der private Header `X-SearXNG-XTend-Contract: 1` aktiviert `searx/xtend_integration.py`. Öffentliche Requests können diesen Header nicht durch den Gateway schleusen. Direkter Zugriff auf interne Core-Ports wird im Container nicht veröffentlicht.

Die zusätzliche Struktur `xtend` enthält Schema `searxng-xtend.core.v1`, effektiven Parserzustand, Paging-Fähigkeit und einen expliziten Fixture-Marker. `paging` bedeutet Fähigkeit, keine zugesicherte nächste Seite oder vollständige Trefferanzahl. Der UI-Text lautet daher „Ergebnisse auf dieser Seite“.

Der Adapter validiert HTTP(S)-Links, lehnt Credentials in URLs ab, begrenzt Antwortgröße auf 2 MiB und Darstellung auf 100 Treffer, entfernt Duplikate anhand einer stabilen URL-/Template-Identität (bei Bildern einschließlich Originalbild-URL) und rendert Titel/Snippets als Text. Keine Raw-HTML-Snippets. Fehler einzelner Engines bleiben sichtbar. Leeres Ergebnis und vollständiger Engineausfall sind verschiedene Zustände.

Bilder werden nur über SearXNGs signierten `image_proxy` eingebunden. Externe Favicons, Fonts und Trackingressourcen werden nicht automatisch vom Browser geladen. Bildquellen ohne verwertbare Proxy-Thumbnails erscheinen als Texttreffer. Das MVP bietet Web/Bilder und drei Sprachoptionen; weitere Kategorien, Spezial-Ergebnistemplates und umfassende Preferences sind über Classic erreichbar.

## Lifecycle

- Direkter Aufruf: URL validieren → ein Core-Aufruf → normalisierte Daten → RMT-SSR einschließlich nativer Controls/Ergebnisse → signierter Resume-Envelope und kompakte Page-Wire-Daten.
- Browser: kleine offizielle `startMaracaPageApplication`-Bootstrapfunktion installiert Input-Capture, lädt Page-/Maraca-Laufzeit und verifiziert die Signatur über den öffentlichen instanzspezifischen JWK.
- Gültiger Envelope: vorhandene DOM-Knoten werden übernommen. Der Test vergleicht das Suchfeld **vor und nach** initialem Resume per Objektidentität.
- Folgesuche: XTend Page Client fängt native GET-Formulare und interne Links ab; eine Page-Antwort aktualisiert die RMT-Inputs durch `dispatchStreamPatch`. Dies ist ein vollständiger Zustands-Patch, **kein behauptetes Ergebnisstreaming**.
- Shell und Suchfeld bleiben auch bei Startseite→Ergebnisse erhalten. Explizite RMT-Keys verhindern Positionswechsel durch das verschwindende Hero-Element.
- History/Back/Forward gehört XTend. Die URL ist kanonischer Suchzustand. Superseded Requests dürfen keine veralteten Ergebnisse sichtbar machen. Während einer Antwort neu getippter Entwurf wird über ein XTend-Command wiederhergestellt.
- Ungültige Signatur: genau der bestehende XTend-Hydration-Fallback. Fehlende Module oder deaktiviertes JavaScript: native GET-Suche. Page-Host-Ausfall: Gateway-Ausfallseite mit Classic-Link; keine automatische doppelte Suchanfrage.

Die öffentliche Suchansicht besitzt keine benutzerabhängigen Props, keine Cookies und keine Once-Props. Ihr `contextKey` ist daher ein gemeinsamer öffentlicher Build-Kontext. Klassische Preferences bleiben auf `/classic` begrenzt und werden vom XTend-Host ignoriert. Werden später Benutzer-/Tenantdaten eingeführt, muss dieser Vertrag durch getrennte und invalidierbare Kontexte ersetzt werden.

## Build und Schlüssel

`scripts/build.cjs` verwendet `createRmtCompilationSession`, `buildMaracaBundleAsync` und `buildPages` aus demselben installierten Paket. Eine Compilation, ein Wiederverwendungs-Treffer; Source-Hash und Manifestversion werden geschrieben. Produktionsprofil, Lazy-Component-Bundle, strikte Orchestration/Kernel/Hydration; Validation/Transitions auf `auto`, da die App keine entsprechenden fachlichen Pläne deklariert. Kein künstlicher leerer Plan zur Erfüllung eines Strict-Schalters.

Der erste Build fiel unbemerkt auf einen lokalen Importgraph zurück, weil Rollup/Terser im Consumer fehlten. Der Browser zeigte fehlende Module. Danach wurden Rollup, Terser und TypeScript explizit gepinnt; der Build bricht bei fehlenden Produktions-Bundlern ab. Der negative Report bleibt in `evidence/builds/degraded-importgraph-report.json`.

Private Schlüssel sind nie Build-Inputs. Der Supervisor legt pro Instanz ein P-256-Paar und ein SearXNG-Secret im Secret-Volume an. Der Browser importiert ausschließlich den öffentlichen JWK über ein Same-Origin-Modul mit `no-store`. Der Host prüft Übereinstimmung des JWK mit seinem privaten Schlüssel. Rotation: Instanz neu starten; alte Resume-Seiten folgen dem geprüften Fallback. Keine WebCrypto-Verifikation außerhalb eines sicheren Browserkontexts versprechen: entfernte Nutzung über HTTPS.

Der App-Host ergänzt ausschließlich `lang="de"` und den eigenen Favicon-Link im Dokumentkopf, weil der untersuchte XTend-Dokumentrenderer hierfür keine Option bereitstellt. Körper, Controls, Ergebnisprojektion und Resume bleiben unverändert XTend-eigen.

## Docker und Betrieb

Ein Multi-Stage-Image enthält Node, Python, Granian, das Produktions-Maraca-Bundle, das exakte XTend-Paket und das zugehörige Quellarchiv. Compose: UID/GID 10001, schreibgeschütztes Root-Dateisystem, separater Secret-Datenträger, begrenztes `/tmp`, keine Linux-Capabilities, `no-new-privileges`, Speicher-/Prozessgrenzen und Healthcheck. Nur Gateway-Port 8080 ist veröffentlicht. Der Source-Download macht den tatsächlich gebauten Stand verfügbar.

BuildKit und älterer Docker-Builder werden unterstützt: neben `Dockerfile.xtend.dockerignore` wurde auch die ursprüngliche Root-Ignoreliste ergänzt. Der zuerst gescheiterte Legacy-Build wurde dokumentiert. Auf dem Testrechner ist Buildx nicht installiert; Compose baut erfolgreich mit dem vorhandenen Legacy-Builder.

Die private Standardkonfiguration verzichtet auf den SearXNG-Limiter, Valkey und einen TLS-Terminator im App-Container. Ein öffentlicher Dienst benötigt eine konkret konfigurierte Schutz-/Proxy-Schicht. Die Seite verspricht weder Anonymität noch das Verschwinden von Suchbegriffen aus Browserverlauf, Betreiber-Logs oder Upstream-Enginekommunikation.

## Streamingentscheidung

**Follow-up.** Der untersuchte Python-Pfad wartet auf `ResultContainer`, verarbeitet Plugins/Sortierung und serialisiert anschließend JSON/HTML. Es gibt an dieser Integrationsstelle keinen geprüften öffentlichen Stream-Vertrag für inkrementelle, final gerankte Ergebnisse. Ein zusätzlicher Polling- oder SSE-Simulator würde weder Corekosten senken noch ehrliche Teilresultate garantieren. Für ein Follow-up müssen Lebenszyklus, Rankingkorrekturen, Fehler, Abbruch und Ressourcenfreigabe zuerst im Core definiert werden.

## MCP-Leistungsprüfung

Der verfügbare lokale XTend-MCP wurde **wirklich über MCP-stdio** aufgerufen: `products/xtend-mcp/src/client.mjs`, Workspace-Root auf dieses `xtend/`-Verzeichnis eingeschränkt. Kein direkter Toolkatalogeintrag im Codex-Host wird behauptet. `scripts/mcp.mjs` protokolliert Toolname, vollständige Eingabe, Hash, Zeitpunkt, Dauer, Rückgabe, Provenance und Datei.

- `xtend_knowledge_context`: Dokumentation und RMT-/Resume-Kontext; zusätzlich gezielte Nachfrage für DOM-Identität/Layout.
- Resource `xtend://docs/en/ssr-pages`: offizieller SSR-/Pages-Pfad.
- `xtend_rmt_compile_check`: zuerst negative Diagnose wegen Objekt-Initialisierung; nach Quellkorrektur erfolgreich. Finaler Source-Hash stimmt mit Build überein.
- `xtend_maraca_plan`: echter Orchestration-/Hydrationplan der finalen RMT-Quelle, keine nachträglich erfundene Planbeschreibung.
- Knowledge-Drift-Prüfung im vorhandenen Checkout: erfolgreich. Build und Browserprüfungen erfolgten zusätzlich über SDK/CLI, da der MCP-Katalog keinen vollständigen Deployment-/Browser-Test ersetzt.

Die ersten Logeinträge nannten einen erfolgreichen MCP-Transport `resultStatus: success`, selbst wenn `data.ok` false war. Maßgeblich bleibt die gespeicherte Rohantwort; der Wrapper unterscheidet inzwischen Transport- und fachlichen Status. Keine negative Compileantwort wird als bestandene Prüfung gezählt.

Bewertungsgrenzen: Ein einzelner autonom ausgeführter Arbeitsablauf, kein kontrollierter Vergleich mehrerer Modelle. Compiler- und Plan-Erfolg allein verifizieren weder Deployment noch UX. Der Importgraph-Fallback, verlorene DOM-Identität bei fehlenden Keys, Shadow-DOM-Layout und Docker-Ignoredatei wurden erst durch unabhängige Ausführung entdeckt und in der Integration behoben.

## Erweiterung: Wissenskarten und Bildvorschau

`MEDIA-SURFACES.md` beschreibt den ergänzten Infobox-Vertrag, RMT-Zustand und die Tests. `frontend/preview.mjs` übersetzt Klicks/Tasten/Bildladefehler in RMT-Commands; Rendering und Zustandsprojektion bleiben XTend-eigen. Es gibt weiterhin keinen zusätzlichen UI-Framework-Layer.
