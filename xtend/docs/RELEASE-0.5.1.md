# XTend.search 0.5.1 — native Melde-UX und tägliche Taglines

Status: vorbereitetes Minor-Update. Frontend `xtend-search:0.5.1`, unverändertes geprüftes privates SearXNG-Backend `xtend-search-searxng:0.5.0`. SearXNG-Pin und XTend-0.9-SDK bleiben unverändert. Keine neue Freigabe von Suchquellen und kein Produktionsdeployment.

## Änderungen

- Suche: monochromes XIcon statt Text, quadratische 48-Pixel-Touchfläche und native zugängliche Beschriftung „Suchen“. XSpinner während PageClient-Navigation und Ergebnisstream. Geordnete Zustandskommandos; Fehler, Abschluss und Cache-Wiederherstellung beenden den Busy-Zustand. Suchbutton bleibt für eine neue Anfrage nutzbar. Favicon-Ergänzungen beginnen erst nach dem veröffentlichten SDK-Ready-Ereignis, damit der signierte SSR-DOM während der Resume-Prüfung unverändert bleibt.
- Ergebnis melden: Formular, Zustimmung, Fehler, Busy-Zustand und XToast gehören dem RMT-Modell. Das Formular wird erst beim Öffnen materialisiert. Der Host hält ausschließlich den kurzlebigen serverseitigen Meldenachweis/CSRF sowie den abbrechbaren App-Service-Aufruf. Navigation verwirft alte Aufrufe. Fehlgeschlagenes Absenden erhält den Entwurf. Signierte Zuordnung, Rate Limits und serverseitige CSRF-Prüfung bleiben bestehen. Native `/feedback`-Formulare funktionieren weiterhin ohne JavaScript.
- Taglines: Observatory → **Startseite**. Administratoren bearbeiten eine Liste (1–50 einzeilige Texte, maximal 160 Zeichen) oder überschreiben den heutigen Text sofort. Pro Kalendertag in **Europe/Berlin** wird eine gemeinsame zufällige Auswahl persistiert. Neustarts würfeln sie nicht neu aus. Manuelle Auswahl endet am nächsten Tageswechsel. Standard: **Neugier braucht Freiraum.**
- Taglines werden als Text ausgegeben, ohne HTML-Ausführung. Neue Besuche sehen Änderungen sofort. Offene Startseiten desselben Browsers aktualisieren über eine datenfreie BroadcastChannel-Benachrichtigung; sonst beim Fokuswechsel oder spätestens beim nächsten 30-Sekunden-Metadatenabruf. Versteckte Seiten und Ergebnisansichten fragen nicht ab. Es entstehen keine Suchsessions und keine Providerabfragen.
- Filter: lokales, gebündeltes Funnel-Icon über XIcon; Beschriftung bleibt. About-Icon näher an der Ecke mit Safe-Area-Abstand. Zentrierter Startseitenaufbau und Header-Morphing bleiben erhalten.

## DOM-Prüfung und Komponenten

Alle vier schreibenden HTML-Parsing-Stellen im eigenen Browsercode wurden entfernt: Meldedialog, About-Inhalt, Lightbox-Bedienelemente und Admin-Entwurfsrückfrage. Auch Belegliste und Regel-Vorprüfung im Observatory werden jetzt über RMT-Zustand statt über direkte DOM-Schreibzugriffe aktualisiert; überholte Antworten werden bei Navigation verworfen. About und Bestätigung benutzen XDialog-Slots mit Text-/DOM-Knoten. Server-HTML für Progressive Enhancement bleibt erhalten. `outerHTML` in Testdiagnosen ist eine lesende Operation. Drei weitere Stellen liegen im unveränderten klassischen SearXNG-Theme (`preferences.ts`, `results.ts`, `keyboard.ts`), weitere in dessen Drittbibliotheken. Diese Assets gehören zum mitgelieferten klassischen SearXNG-Theme, werden von der Standalone-XTend-Shell nicht geladen und erhalten in diesem Frontend-Update keine RMT-Adapter. Statische Shadow-DOM-Implementierungen innerhalb des gepinnten SDK sind Framework-Verantwortung und werden nicht pauschal umgeschrieben.

`x-search-lightbox` ist eine explizite Projektkomponente auf Basis der geprüften XLightbox 0.9.0. Provenienz einschließlich SHA-256 steht am Quellanfang. Sie erhält den nativen Overlay-/Fokus-/Portal-Lifecycle und ergänzt einen Controls-Slot sowie `configureSearch`, `openCarousel`, `closeCarousel`, `isCarouselOpen`, `updateCarousel`. Suchspezifisches Carousel, Links und Bildfehler gehören zu ihrem Lebenszyklus. Die bisherigen esbuild-Umschreibungen an der SDK-Lightbox entfallen. Die SDK-Lizenz wird weiter ausgeliefert. Suchspezifische Providerregeln gehören nicht ins Framework.

## Speicher und Zugriff

Additive SQLite-Migration `user_version=3`: `site_content` enthält ausschließlich die Tagline-Liste und Tagesauswahl. Vorhandene Freigaben, Guards, Qualitätspausen, Budgets und Nextcloud-Konfiguration bleiben erhalten. Administrator-Änderung und Audit werden in derselben revisionsgeprüften Transaktion gespeichert. Idempotenz schützt Wiederholungen. Viewer und Operatoren können lesen, aber keine Taglines ändern; `XTEND_ADMIN_MUTATIONS=0` bleibt verbindlich.

## Installation / Upgrade

1. Bestehende Images und **Control-/Backend-/Evidence-Volumes sichern**, während der Dienst gestoppt ist. Env-Datei/Portainer-Variablen geschützt sichern; Secrets niemals ins Git übernehmen.
2. Paket `XTend-search-Docker-0.5.1-linux-amd64.tar.gz` entpacken. `sha256sum -c SHA256SUMS` und `./load.sh` ausführen. Darin liegen Frontend-Archiv **0.5.1** und unverändertes Backend-Archiv **0.5.0** mit eindeutigen Namen und Image-IDs.
3. Im vorhandenen Portainer-Stack Frontend auf `xtend-search:0.5.1` setzen. `compose.portainer.yml` erwartet weiterhin das private Backend 0.5.0. Vorhandene Variablen, Volume-Namen, `XTEND_PORT` und SSO-Redirect beibehalten. Kein `down -v`.
4. Starten; Readiness, SSO, Quellenfreigaben und Suche prüfen. Observatory → Startseite öffnen. Für die Taglines sind keine zusätzlichen Env-Variablen nötig.
5. Browser einmal neu laden, damit RMT, Host und Manifest dieselbe Build-Version verwenden.

Rollback: Dienste stoppen, Frontend 0.5.0 sowie gesicherte Datenvolumes wiederherstellen und mit unverändertem Backend 0.5.0 starten. Nicht ungeprüft eine bereits migrierte Datenbank an ältere Releases übergeben.

## Nachweise

Verbindliche Prüfungen und Ergebnisse stehen in `evidence/control-plane/0.5.1-*.json`: Strict-Maraca, Node-/Python-/Dependency-Gates, Docker/Portainer-Smokes, tägliche Persistenz und Berlin-Tagesgrenzen, Rollen/Revision/Replay, Metadatenaktualisierung, Meldefehler mit Retry/Abbruch, Spinner-Terminalzustände und vorhandene Such-/Cache-/Bild-/Admin-/SSO-/No-JS-Regressionen. Bundlegrößen werden gegenüber 0.5.0 separat ausgewiesen.

XTend-MCP war in dieser Sitzung nicht als Werkzeug exponiert. Komponenten- und RMT-Verträge werden gegen das gepinnte SDK geprüft; dies sind SDK-/CLI-Nachweise, keine behaupteten MCP-Aufrufe. Produktionsdeployment, Merge und Framework-Publishing bleiben separate Schritte.

Lokale abschließende Abnahme: **93/93 Control-Plane-Tests**, **10/10 weitere Node-Anwendungstests**, **7/7 Backend-Verträge**, alle zehn Browser-Suiten und der Portainer-Smoke bestanden. Zehn identische Offline-Performance-Läufe gegenüber 0.5.0: erster Treffer median 511,9 statt 485,4 ms (**+5,46 %**); Streamabschluss 2.977,5 statt 2.973 ms; übertragenes JS gzip +25.818 Bytes; CLS in allen Läufen 0. Hardware-/Fixture-Scope und Einzelläufe stehen im Performance-JSON, kein Versprechen für Live-Provider oder andere Geräte. Die spezialisierte Lightbox besitzt einen CI-Hash-Guard für Änderungen ihrer SDK-Basis.
