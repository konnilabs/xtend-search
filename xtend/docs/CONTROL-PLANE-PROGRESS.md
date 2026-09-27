# XTend.search 0.3.0 – CP-001 Abnahme

Stand: 26.09.2026. **Implementierter, lokal überprüfter Release; keine pauschale Produktionsfreigabe aller ADR-Gates.** Der bestehende Produktionsdienst und die lokale 0.2.1-Instanz bleiben erhalten. Echte Quellen sind nicht automatisch freigegeben.

## Entscheidungen und Evidenz

- SearXNG `e831fc2a1cad50c9979b5f6f680376410218188c`, XTend Hydrangea 0.8.0; vorhandener vendorter Buildpfad. Getrennter Node- und Python-Container, konfigurierbare `SEARXNG_BASE_URL` und gemeinsames Backend-Secret.
- Nextcloud **eingebautes OAuth2** + OCS-Identitätsprüfung, explizite Rollen. Echter lokaler Login vom Benutzer erfolgreich bestätigt. Nextclouds beobachteter doppelter `/cloud`-Pfad und der noch ausstehende frische Produktionslogin sind im Runbook dokumentiert.
- Normale Daten über Maraca AppServices/NDJSON; alter XScaler-/Bridge-Pfad bleibt im 0.2.1-Rollback. Keine zusätzliche React/Vue-Schicht, kein eigener Ersatz für PageClient.
- SQLite hält Policies, Audit, Cooldowns, Quoten und begrenzte Telemetrie. Standard: gesperrte Quellen, Probes aus, konservative Auswahl.
- Historische Arbeitsschritte sind durch MCP-Journal, Quellhashes, Testskripte und Rohbelege nachvollziehbar. Es wurde kein nachträglich als „vor Implementierung“ ausgegebener G0-Git-Commit konstruiert; die G0-Evidenz liegt als Datei vor.

## Gates

| Gate | Befund |
|---|---|
| G0 Protokoll/Isolation | Lokal belegt: tatsächlicher SearXNG-Processor-Dispatch bleibt bei expliziter Engine isoliert; negative Kontrollen zeigen Kategorie-/Bang-/Unknown-Risiken. Adapter sperrt diese Eingaben. |
| G1 Node/Resume | Docker- und Browsernachweis für SSR, Resume, History, Filter, Medienpfad, XLightbox und Paging. Öffentliche Seite lädt keinen Admin-Graph. Legacy bleibt separat erhalten. |
| G2 Registry/Privacy | Canary, Rollen-/Secretgrenzen, echte Katalogdiscovery und inhaltsfreie persistente Telemetrie geprüft. Produktions-Proxy-Logkonfiguration weiterhin vom Betreiber zu bestätigen. |
| G3 Executor | Frühe Browser-Batches auch hinter gzip-Proxy, stabile Trefferpositionen, Quoten, Cancellation und Cursor geprüft. Live-Provider-Qualitätsprofile und reale Produktionsmessung ausstehend. |
| G4 Recovery/Knowledge | Deterministische Prüfungen für gemeinsame Cooldowns, Neustart, Audit-Recovery, harte Filter, Ambiguität und Fallbackdomänen bestanden. Keine Behauptung einer getesteten produktiven Wikimedia-Verfügbarkeit. |
| G5 Admin/Betrieb | Funktionsfähige Admin-UI, echter lokaler Nextcloud-Login, Docker-/Installationsartefakte und Runbooks vorhanden. Produktions-Cutover erst nach produktivem SSO-Test, Quellen-/Budgetfreigabe, Backup und Qualitätsprüfung. |

## Akzeptanzmatrix

| ADR-ID | Nachweis / Grenze |
|---|---|
| A01 / A02 | `browser.json`, `paint.json`: drei Offline-Engines 100/700/2500 ms; erster sichtbarer Batch vor den langsamen Quellen, Docker + private Bridge + flushender gzip-Proxy. |
| A03 / A04 | Bounding Boxes sichtbarer Texttreffer bleiben stabil, append-Reihenfolge bleibt erhalten, gemessener CLS im Standalone-Textlauf. Knowledge reserviert Layout; kombinierte späte Knowledge-/Bild-CLS-Messung noch kein vollständiger eigener Benchmark. |
| A05 | Superseded Query im realen Browser; alte Invocation kann neue Surface nicht ersetzen. |
| A06 | Ungültiges JSON, doppelte Frames und fehlender Abschluss: kontrollierter Endzustand, keine doppelten Treffer / automatische Vollsuche. |
| A07 | Echte Processor-Instrumentierung + Adaptervertrag: ausschließlich geprüfte Parameter, keine Browsercookies; negative Kategorie-/Bang-/Unknown-Kontrollen. |
| A08 / A09 | HTTP-200-Fehler, CAPTCHA, Rate-Limit, längstes Retry-After, Backend-Ingress und unbekannte Fehler getrennt; Admin-Probe kann Fristen nicht umgehen. Native Endzeit wird als unbekannt gekennzeichnet. |
| A10 / A11 | Gleichzeitige letzte Tokenreservierung, leere Allowlist, Filterausschluss und sämtliche Engines fehlerhaft getestet. |
| A12 | Adapter-/Backendfehler werten nicht pauschal Provider ab; vorhandene UI bleibt nutzbar. Vollständiger Docker-Netztrennungs-Soak nicht ausgeführt. |
| A13 / A14 | Abbruch ohne weitere Commits, verbuchte Kosten/Leases über Neustart, Cooldowns über Neustart, korrupter Store fail-closed. |
| A15 | Neue Engines bleiben gesperrt; anderer Version-/Plugin-/Capabilityvertrag verweigert Freigabe. |
| A16 / A17 | Knowledge bleibt eine attribuierte Entität; mehrdeutig statt geraten. Rate-Limit-Fallback nicht in derselben Domäne. |
| A18 | Synthetische Canary in Erfolgs-, Providerfehler- und Parserablehnungspfad: keine Treffer in Containerlogs oder persistenten Control-Dateien. Keine uneingeschränkte Behauptung über unbekannte Produktions-Log-Sinks. |
| A19 / A20 | Browser-Rollen, CSRF, Revision, Idempotenz; tatsächlicher SQLite-Audit-Insertfehler rollt Policy und Revision zurück. |
| A21 | Telemetriequeue/-retention begrenzt, Drop-Zähler sichtbar; Adminstream-Kontingent getestet. Snapshot-Resynchronisation, kein Event-Replayversprechen. Langer Backpressure-/Memory-Soak offen. |
| A22 / A23 | Cursor-Manipulation/Filterbindung/gesperrte Quelle/Seite 2; zweiter Docker-Owner per flock und Mehrfachworker explizit abgewiesen. |
| A24 | 390 px und 720 px Layout, >=16px-Inputs, Tastatur im Carousel, native Bedienelemente/Labels. 720 px simuliert 200%-Platzangebot, keinen echten Browserzoom; manueller Screenreader-/iOS-Hardwaretest offen. |
| A25 | Synthetische Web-/Bilder-/News-/Video-Daten und strikte Filtervertragstests. Keine Live-Abdeckungs-/Relevanzfreigabe je Sprache/Mode ohne vom Betreiber freigegebene Provider und Budgets. |

Die Testdateien sind unter `xtend/tests/control/` ausführbar; Rohbelege unter `xtend/evidence/control-plane/`. Der Releasebericht nennt Messergebnisse und Bundlegrenzen. Nicht vollständig nachgewiesene Zeilen sind keine stillschweigend bestandene Produktionsabnahme.

## Definition of Done für diesen lokalen Release

Implementierung, reale Admin-Aktionen, Buildgraphen, Isolation, lokale OAuth-Identität, synthetische Such-/Fehlerpfade, Docker-Artefakte, entsprechende Quellen und Installations-/Rollback-Anleitung sind vorhanden und überprüft. Benutzersecrets und Produktionsfreigaben werden nicht ausgeliefert. Die breite Produktions-DoD des ADR bleibt bis zur Quellen-/Qualitätsfreigabe und zum überprüften Cutover ausdrücklich offen.
