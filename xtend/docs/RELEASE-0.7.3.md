# XTend.search 0.7.3 — Vollflächige Lightbox und robustere Bildvorschauen

Grundlage ist GitHub-`main` `b84816c41` nach PR #21. Auch der lokale Haupt-Checkout wurde von `389239284` auf diesen Stand vorgezogen; die unversionierte Devcontainer-Datei blieb erhalten. Das SDK ist weiter exakt auf `66ffa8fa4423…` gepinnt, das geprüfte SearXNG-Backend bleibt 0.5.1. Es gibt keine Datenmigration.

## Bildansicht

Der MVC-Umbau hatte den projektspezifischen XLightbox-Fork durch einen begrenzten XDialog ersetzt. Der bisherige Browsertest erwartete ausdrücklich einen XDialog und hat die falsche Darstellung damit abgesichert. Die Ansicht verwendet wieder **XSearchLightbox**, einen lokalen Apache-2.0-Fork von XTend XLightbox mit Medien-, Steuerungs- und Schließen-Slots. RMT besitzt Bilder, Auswahl, Links, Ladezustand und Sichtbarkeit. Die Komponente konstruiert nur ihre private statische Shadow-DOM-Hülle mit nativen DOM-APIs. Es werden weder HTML-Strings eingefügt noch SDK-Dateien umgeschrieben oder Hosts nach `document.body` verschoben.

Die Hülle liegt in der nativen Top-Layer und füllt den Viewport statt einer begrenzten Dialogbox. Das native Dialogelement dient dabei nur Fokus und Hintergrund-Inertheit, es ist kein XDialog. Carousel, Quellseiten-/Original-Link, Escape, Schließen, Pfeiltasten, Touch-Geste und Fokus-Rückgabe bleiben erhalten. SSR-Capabilities werden explizit mit `manifest` und `sourceTexts` registriert. Der Architekturtest erlaubt ausschließlich die Konstruktion der privaten Shadow-Hülle im Konstruktor dieses einen Custom Elements; Controller und dynamische Inhalte bleiben unter der bestehenden RMT-Prüfung.

## Bildresilienz

- Ein fehlgeschlagenes Thumbnail erhält genau eine andere, bereits serverseitig signierte Originalquelle als Alternative. Schlägt auch diese fehl, bleibt der Platzhalter. Es gibt keine automatischen Wiederholungsschleifen oder direkten Browserkontakte zu Bildanbietern.
- Lädt ein zuvor fehlgeschlagenes Original in der Seiten- oder Vollbildvorschau später erfolgreich, wird diese Information über die bestehende RMT-Projektion auf die Übersicht übertragen. Veraltete Projektionen bleiben durch den vorhandenen Compare-and-set-Vertrag gesperrt.
- Der Medienproxy bearbeitet maximal zwölf Abrufe parallel und nimmt bis zu 32 weitere in eine abbrechbare Warteschlange auf. Gleichzeitige Abrufe derselben geprüften URL teilen sich einen laufenden Abruf. Bei weiterer Überlast bleibt eine explizite 429-Antwort erhalten.
- Erfolgreiche Bildbytes werden bis fünf Minuten in einem gemeinsamen RAM-LRU gehalten: maximal 128 Einträge und 32 MiB. Fehler werden nicht gecacht. Browser dürfen erfolgreiche Antworten privat bis maximal fünf Minuten und höchstens bis zur Signatur-Expiry wiederverwenden. Keine Nutzerzuordnung, Ergebnis-Sessions, URL-Telemetrie oder persistenten Bilddateien werden eingeführt.
- Signaturen werden auch vor Cache-Treffern geprüft. DNS-/IP-/Redirect-Prüfungen gegen private Ziele, erlaubte Bildformate, acht MiB je Antwort und das Upstream-Budget von 300 neuen Abrufen pro Minute bleiben wirksam. Ein aktiver Abruf hat höchstens acht Sekunden, ein HTTP-Auftrag inklusive Wartezeit höchstens zwölf Sekunden. Abbruch eines Clients beendet keinen noch von anderen Clients benötigten gemeinsamen Abruf.

Tatsächlich defekte, abgelaufene oder vom Anbieter gesperrte Bilder können weiterhin fehlen. Die Maßnahmen reduzieren insbesondere Lastspitzen, kaputte Thumbnail-Endpunkte und unnötige Wiederabrufe; sie behaupten keine Vollständigkeitsgarantie.

## MCP, Prüfung und Auslieferung

Der vorhandene Docker-MCP wurde über seinen authentifizierten Loopback-Endpunkt gelesen. Tatsächliche `initialize`, `tools/list`, Knowledge-Kontext- und Ressourcen-Aufrufe einschließlich Eingaben und Antworten sind ohne Token in `xtend/evidence/mcp/0.7.3-lightbox-context.json` dokumentiert. Sein Wissensstand ist Framework-Commit `c31e380f…`; die Konstruktion wurde zusätzlich gegen das tatsächlich gepinnte SDK geprüft. Das MCP bestätigt die öffentliche XLightbox-API ohne Carousel-/Link-Slot und die explizite SSR-Registry. Es wurde keine MCP-Schreiboperation ausgeführt.

Tests decken die Viewport-Geometrie bei 320–3840 Pixeln mit einer 100-Treffer-Galerie, Slots, Links, Fokus, Tastatur, Reduced Motion, Navigation, Thumbnail-/Original-Fehler und erfolgreiche Wiederherstellung ab. Proxy-Tests prüfen Warteschlange, Deduplizierung, Abbruch, TTL/LRU, Bytegrenzen, Fehler und Cache-Autorisierung. Der bestehende Wettertest verwendet jetzt alle gültigen Wochentage statt vorauszusetzen, dass „Donnerstag“ in jeder laufenden Sieben-Tage-Prognose vorkommt.

Vor dem lokalen Upgrade werden Volumes und die geschützte Env-Datei gesichert. Danach nur das Frontend auf `xtend-search:0.7.3` aktualisieren und Browser-Tabs neu laden. Das Backend bleibt `xtend-search-searxng:0.5.1`; ein Rollback auf 0.7.2 benötigt keine Konvertierung. Merge und Produktionsdeployment bleiben getrennte Schritte.

## Ergebnisse der Abnahme

149 Control-Plane- und zehn Anwendungstests bestehen ohne Fehler oder ausgelassene Tests. Die Strict-Maraca-Builds, neun Browser-Gates und der Portainer-Smoke sind geprüft. Die HTML-Sicherheitsprüfung erfasst 38 eigene Browserquellen ohne Diagnose; die Architekturprüfung schützt die Konstruktorgrenze zusätzlich. Der alte SDK-XLightbox-Renderer ist nicht im Bundle. Der neue Lightbox-Chunk wird bei Bedarf geladen und umfasst 6.690 Bytes beziehungsweise 2.928 Bytes gzip.

Im identischen Offline-Fixture-Vergleich beträgt CLS sowohl beim Bootstrap als auch beim Suchstream und den Wetterabschnitten null. Der erste Ergebnis-Paint liegt im Mittel bei 549 ms (0.7.2: 577 ms), der Streamabschluss bei 3.149 ms. Vier Sekunden verzögerte Favicons blockieren den Suchabschluss nicht. Cache-Wiederherstellungen erzeugen null zusätzliche Suchstreams; die Epochenprüfung bleibt bestehen. Diese Werte sind lokale Fixture-Messungen und keine Aussage über die Latenz realer Anbieter. Der vollständige Nachweis steht in `xtend/evidence/control-plane/0.7.3-verification.json`.
