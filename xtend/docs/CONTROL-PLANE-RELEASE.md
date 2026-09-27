# XTend.search 0.3.0 – Releasebericht

26. September 2026 · Linux amd64 · XTend 0.8.0 Hydrangea

## Neue Version

Die Suchoberfläche und der SearXNG-Suchkern laufen jetzt in getrennten Docker-Containern. Das neue Operations Observatory unter `/admin` verwaltet Quellenfreigaben, Quoten, Quarantäne, Drain, Probes und Routing. Nextclouds eingebautes OAuth2 mit exakter Rollenfreigabe ist integriert; der echte lokale Login wurde erfolgreich durchgeführt.

Initial-SSR, signierte Resume Seeds, clientseitige Navigation, Suchfilter, Browserhistory, eigene XTend.search-Marke und „Powered by SearXNG“ bleiben erhalten. Der neue Einzel-Engine-Executor liefert echte frühe AppService-Batches, behält bereits angezeigte Treffer an ihrer Position und signiert die Seitennavigation. Bildvorschau, Carousel-XLightbox, XAlert und automatische Platzhalter funktionieren über den geschützten Medienproxy.

Zusätzlich zu Web und Bildern erscheinen freigegebene weitere Kategorien als Tabs. Neue Quellen sind zunächst gesperrt; aktive Probes sind standardmäßig abgeschaltet. Der frühere 0.2.1-Dienst bleibt als kontrollierter Rollbackweg erhalten. Diese Version wurde nicht auf den Produktionsserver ausgerollt.

## Verifiziert

- 36 Control-Plane-/Security-/Storage-Tests und 10 bestehende Normalisierungs-/Suchtests bestanden.
- RMT-Compilerchecks über den echten XTend-MCP und Maraca-Browser-/Serverbuild erfolgreich.
- Docker-Browsertests: echte Admin-Formulare, Quellenauswahl ohne Dokumentreload, Rollen, CSRF, Revisionen, Betriebsmodus, Probe und Drain; mobile Breiten, 16px-Inputs, SSR ohne JavaScript, History und überholte Suchanfragen.
- Fehlerpfade: blockierte Bilder/Carousel, signierte Seite 2, ungültiges JSON, doppelte Frames, fehlender Streamabschluss; keine automatische versteckte Vollsuche.
- Echte SearXNG-Processor-Instrumentierung belegt Einzel-Engine-Isolation. Quoten/Fristen, Neustart, konkurrierende Reservierungen und tatsächlich fehlgeschlagener SQLite-Auditschreibvorgang geprüft.
- Private Backend- und Artefaktgrenzen, fehlende Query-Canaries in persistenten Dateien/Containerlogs sowie Ablehnung eines zweiten Volume-Besitzers und mehrerer Worker geprüft.

## Vergleichsmessung

Je drei lokale Läufe, identischer Pool aus drei Offline-Engines (100/700/2500 ms), jeweils 10 eindeutige Ergebnisse nach Deduplizierung. Mediane; kleine synthetische Stichprobe, keine Produktionsprognose. Chromium 145, Node 24.19.0, Ryzen 5 3600, Linux 6.8.0-142. Desktop 1440×1000. Standalone mit privatem Docker-Netz und flushendem gzip-Proxy. Legacy und SSR-Referenz nutzen den erhaltenen 0.2.1-Gateway; SSR-Referenz ist die native SearXNG-Template-Ansicht desselben gepinnten Cores mit Produktbranding und Testengine, kein unverändertes externes SaaS-Angebot.

| Variante | Erste sichtbare Treffer | Vollständige Seite | Treffer | Engine-Dispatches |
|---|---:|---:|---:|---:|
| 0.2.1 XScaler | 402 ms | 2899 ms | 10 | 3 |
| 0.3.0 konservativ | 370 ms | 2879 ms | 10 | 3 |
| 0.3.0 adaptiv | 388 ms | 2889 ms | 10 | 3 |
| 0.3.0 gedrosselt | 1518 ms | 3795 ms | 10 | 3 |
| SearXNG SSR-Referenz | 2579 ms | 2584 ms | 10 | 3 |

Gedrosselt: CPU ×4, 80 ms emulierte Latenz, 1,6 Mbit/s Download und 750 kbit/s Upload. Der adaptive Test benutzt denselben kleinen Dreierpool; er belegt keinen Qualitäts- oder Relevanzvorteil gegenüber konservativer Auswahl. Die Browsermessung enthält den Page-/Streamweg ab Absenden nach abgeschlossenem Startseiten-Bootstrap, nicht die komplette Kaltstartzeit des Browsers. Die SSR-Referenz misst den direkten Dokumentaufruf. Alle Varianten verwenden dieselben Fixture-Antworten, Filter und drei tatsächlichen Engine-Dispatches; die Standalone-Variante benötigt dafür drei interne HTTP-Aufrufe, Legacy/SSR einen.

Der instrumentierte funktionale Dockerlauf zeigte ebenfalls frühe Batches trotz `Content-Encoding: gzip`; Bounding Boxes bereits sichtbarer Texttreffer blieben unverändert. Die Standalone-Läufe meldeten CLS 0 im gemessenen Textszenario, Legacy rund 0,043. Browser-Layoutshift schließt jüngste Benutzereingaben aus; dies ersetzt keinen vollständigen mobilen Knowledge-/Bild-CLS-Test.

## Bundle und offene Performanceziele

Öffentlicher initial geladener JavaScript-Transfer im Benchmark: 469.046 Bytes komprimiert (rund 458 KiB), gegenüber 464.091 Bytes im 0.2.1-Pfad. Der native SSR-Referenzpfad benötigt 6.990 Bytes. Kein Admin-Asset wurde von der öffentlichen Seite geladen; XLightbox wird erst bei Bedarf importiert. **Das frühere 150-KiB-Ziel ist nicht erreicht.** Der allgemeine Maraca-Size-Gate bleibt ausdrücklich eine Warnung, während Servicegraph-Grenzen strikt geprüft werden. Ein Framework-/Bundleabbau ist ein eigenes Follow-up.

Die ADR-Ziele von 100 ms p95 Adapterbatch→Paint und 10 ms p95 zusätzlicher Planner-/Gatewayzeit wurden nicht mit hinreichender Ende-zu-Ende-Instrumentierung nachgewiesen. Kein erfundener p95 aus drei Gesamtläufen. Long Tasks, rohe Einzelzeiten und Transferzahlen stehen im Messbeleg. Mobile Hardware, Screenreader, lang laufender Ressourcen-/Backpressure-Soak und die produktive Proxy-/Provider-Messung sind noch offen.

## Installation und Produktionsfreigabe

`XTend-search-Install-0.3.0-linux-amd64.tar.gz` enthält beide Docker-Images, Compose, Setup, entsprechende Quellen, Prüfbelege, Prüfsummen und Runbooks. `prepare.sh` lädt die Images und erzeugt ausschließlich lokal neue Secrets. Vorhandene `.env.control` wird nicht überschrieben. Konkrete Installation und Nextcloud-Callback-Adressen: `INSTALLATION.md`.

Vor der Produktionsumstellung sind der korrekte öffentliche OAuth-Client, ein frischer Login, explizite Quellen-/Budgetfreigaben, Backup und Qualitätsprofile zu prüfen. Beim lokalen Nextcloud-Test wurde ein doppeltes `/cloud` innerhalb des Provider-Loginpfads beobachtet; der vollständige Befund und die erfolgreiche Benutzerfreigabe stehen im Runbook. Dies wurde nicht durch Lockerung der Auth-Prüfung verdeckt.

Die lokale Funktionsfreigabe ist von der breiten Produktionsabnahme getrennt: `ACCEPTANCE.md` benennt die noch offenen ADR-Punkte. Keine Produktionsquellen oder Providerbudgets werden erfunden oder im Installationspaket vorab freigegeben.
