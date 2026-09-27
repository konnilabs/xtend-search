# XTend.search 0.3.3 — Favicon und About-Dialog

Das neue Frontend-Image heißt `xtend-search:0.3.3`. Der private SearXNG-Suchkern bleibt `xtend-search-searxng:0.3.0`.

## Sichtbare Änderungen

- Das vorhandene XTend.search-Favicon ist wieder im Dokumentkopf eingebunden, als SVG und mit dem bisherigen PNG als Fallback. Das gilt für Startseite, Ergebnisse, Observatory, Anmeldung und direkte About-Aufrufe. Der Kopf bleibt auch bei clientseitiger Navigation vollständig.
- Der funktionslose Link „Einstellungen“ wurde aus der Suchnavigation entfernt. Filter und das Speichern von Standards bleiben direkt über „Filter“ erreichbar.
- „Über XTend.search“ und „Über & Datenschutz“ öffnen einen nativen **XDialog**. Die Suchseite bleibt erhalten. Inhalte sind in kurze Abschnitte zu Suche, Einstellungen und Privatsphäre gegliedert. „Powered by SearXNG“, die Versionsnummer und der Quellcode-/Lizenzdownload sind direkt zugänglich.
- Escape, der Schließen-Button und Hintergrundklick schließen das Modal. XDialog übernimmt die Tastatur-Fokusführung. Der Host sperrt den Seitenhintergrund und stellt Scrollposition sowie Fokus wieder her.
- Unter `/info/de/about` bleibt eine lesbare, eigenständige Seite erreichbar. `/info/en/about` bietet die englische Fassung. Ohne JavaScript, vor dem Resume oder bei fehlgeschlagenem Nachladen führen die About-Links weiterhin auf diese Seiten. Neue Tabs und modifizierte Klicks behalten das normale Linkverhalten.
- Helles/dunkles Farbschema, kleine Viewports und reduzierte Bewegung werden berücksichtigt. XDialog wird erst bei Bedarf aus dem lokalen Bundle geladen.

## Update in Portainer

1. Archiv auf den Docker-Host übertragen und die mitgelieferte SHA-256-Prüfsumme kontrollieren.
2. Importieren:

   ```bash
   docker load -i XTend-search-Docker-Image-0.3.3-linux-amd64.tar.gz
   ```

3. Im bestehenden Stack `XTEND_SEARCH_IMAGE=xtend-search:0.3.3` setzen. Alle vorhandenen URLs, Ports, Nextcloud-Werte, Tokens und benannten Volumes beibehalten. Backend-Image bleibt `xtend-search-searxng:0.3.0`.
4. Den Stack aktualisieren, ohne das lokal importierte Image erneut aus einer Registry zu ziehen. `pull_policy: never` steht in der mitgelieferten Compose-Datei.
5. `/health/ready`, `X-XTend-Version` oder die Observatory-Fußzeile müssen **0.3.3** anzeigen. Die Image-ID steht in `XTend-search-0.3.3-IMAGE-ID.txt`.

Eine erneute Anmeldung im Observatory kann nach dem Containerwechsel erforderlich sein. Vorhandene Quellenrichtlinien und gespeicherte Browserfilter werden nicht geändert. Das Archiv enthält ausschließlich das Frontend; Neuinstallationen benötigen zusätzlich das Backend-Image 0.3.0.

Rollback: Den Frontend-Tag im selben Stack auf `xtend-search:0.3.2` zurückstellen und neu bereitstellen. Volumes beibehalten; es gibt keine Datenbankschemaänderung.

## Engineering-Nachweis

XTend MCP 0.8.0 lieferte den öffentlichen XDialog-Vertrag über `xtend_knowledge_context`; Such-RMT wurde mit `xtend_rmt_compile_check` geprüft. Die Implementierung verwendet `open()`, `close()`, `dialog-opened`, `dialog-closed`, den Standard-Slot und dokumentierte CSS Parts. Keine Framework-Datei und kein Shadow DOM werden verändert. Der kleine Host-Adapter ergänzt die Dokument-Sperre, da die vorhandene XDialog-Version diese nicht selbst ausführt.

Modal und direkte Seite teilen eine statische Inhaltsquelle. Es werden keine Suchbegriffe, Nutzerdaten oder Providerinhalte als HTML eingesetzt. Die bestehenden Such-, Resume- und XScaler-Pfade bleiben Eigentümer der Suche. Nachweise und Screenshots: `xtend/evidence/control-plane/release-0.3.3-*`.

Der erste Docker-Browsertest erkannte `page.invalid_head`: Favicon-Links gehören im verwendeten Page-Host nicht zum erlaubten Head-Record-Vertrag. Die endgültige Umsetzung ergänzt sie in der statischen HTML-Dokumenthülle; der PageClient verändert ausschließlich seine markierten Head-Knoten. Die Tests prüfen ihre Erhaltung nach Resume und Streaming.
