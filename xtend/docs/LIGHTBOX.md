# XTend-XLightbox mit Ergebnis-Carousel

Die Bildvorschau öffnet über Klick auf das große Bild bzw. „Vollbild öffnen“ eine browserfensterfüllende klassische **XTend-XLightbox**. Sie beginnt beim ausgewählten Treffer und umfasst alle bildfähigen Treffer der aktuellen Ergebnisseite. Titel, Zähler und Links zu Quelle/Original bleiben verfügbar. Vor/Zurück, Pfeiltasten sowie Touch-Wischen blättern; nach dem letzten Bild folgt das erste. Home/End springen an die Grenzen. Es werden keine weiteren Ergebnisseiten automatisch abgerufen.

Die Auswahl wird über das bestehende RMT-Command in die Sidebar zurückgeschrieben. Escape schließt zunächst die Lightbox und gibt den Fokus an „Vollbild öffnen“ zurück (bei nicht erreichbarem Bild an die Schließen-Schaltfläche der Sidebar); ein weiteres Escape schließt die Sidebar. Suche, URL und Dokument bleiben erhalten. Eine Such-/History-Navigation verwirft die geöffnete Lightbox und einen noch laufenden Öffnungsversuch.

## Komponentenvertrag und begrenzte Erweiterung

Der untersuchte 0.8.0/Hydrangea-Snapshot enthält `x-lightbox` mit `src`, `alt`, `open()`, `close()`, `snapshot()` sowie `lightbox-opened` und `lightbox-closed`. Er enthält **keine native Carousel-API** und nur einen Trigger-Slot. Die Integration behauptet daher nicht, dass `items` oder `index` bereits Teil des SDK wären.

- `frontend/lightbox.mjs` importiert die tatsächliche Komponente über den öffentlichen Paketexport `@ccslabs/xtend/components/xlightbox.js`. Es wird kein zweites Lightbox-Widget nachgebaut. Der Browsercheck vergleicht den Konstruktor mit `window.XLightbox` und prüft `snapshot().componentRef`.
- Der Import liegt hinter `import('./lightbox.mjs')` im Sidebar-Adapter. Komponente und Carousel werden erst auf ausdrückliches Öffnen geladen. Ein eigener zweiter Classic-Loader ist für diesen gebündelten Export nicht erforderlich.
- `patches/xlightbox-controls.cjs` fügt beim esbuild-Schritt genau einen benannten `controls`-Slot direkt nach dem Media-Element ein. Dadurch liegen die projizierten Carousel-Controls innerhalb des vorhandenen modalen Dialogs. Das ist eine **projektspezifische Erweiterung des Komponentenvertrags**, kein unverändert verfügbarer Upstream-Slot. Ein abweichender Quellanker bricht den Build ab und verlangt Prüfung. Paketarchiv, installierte SDK-Dateien und lokaler XTend-Entwicklungscheckout werden nicht verändert.
- Der Adapter erstellt einmalig eine Classic-Komponente direkt unter `document.body`. Dadurch konkurrieren XLightbox-Portaling und RMT-Reconciliation nicht um denselben Knoten. Die Sidebar bleibt RMT-eigen; das Carousel verwendet die beim Öffnen übernommenen normalisierten Treffer und schreibt Auswahländerungen über `search.preview.open` zurück.
- Die Darstellung verwendet freigegebene CSS Parts und eigene projizierte Controls. Bildladeereignisse werden an der offenen Shadow-Grenze anhand des veröffentlichten `media`-Parts erfasst; komponenteneigene DOM-Knoten werden nicht ersetzt. Der Adapter nutzt keine privaten Instanzfelder.

Der Slot-Patch sollte bei einer späteren XTend-Version durch einen offiziellen Content-/Controls-Slot oder eine native Carousel-API ersetzt werden. Die Aktualisierung des gepinnten SDK benötigt erneute Build-, Fokus- und Browserprüfungen.

## Zugänglichkeit und Fehlerpfade

Der Adapter ergänzt zum vorhandenen Dialog eine Fokusbegrenzung über Shadow-/Slot-Grenzen, stellt vorherige `inert`-Werte und Scroll-Einstellungen wieder her und verhindert eine doppelte Escape-Behandlung. Die zugängliche Baumansicht enthält Schließen, Bild, Carousel-Buttons, Zähler, Titel und Links innerhalb des Dialogs. Der beim Schließen zurückgegebene Fokus wird anhand der aktuellen Sidebar-ID aufgelöst, da RMT den Button inzwischen neu projiziert haben kann.

Nur das ausgewählte Original und ein eventuell benötigtes Ersatz-Thumbnail werden geladen; es gibt kein Vorabladen aller Originale. Das Carousel verwendet ausschließlich normalisierte signierte Same-Origin-Bildproxy-URLs. Externe Providertexte gelangen per `textContent` in die Beschriftung, nicht als HTML. Original-/Quelllinks behalten die zuvor geprüften HTTP(S)-Adressen und `noreferrer`.

Bei einem nicht erreichbaren Original wird das Thumbnail versucht. Scheitert auch dieses, bleiben Fehlermeldung, Vor/Zurück und Quellenlinks bedienbar. Kann das optionale Modul nicht geladen werden, bleibt die Sidebar mit verständlichem Hinweis erhalten. Ohne JavaScript bleiben die vorhandenen nativen Bildlinks erhalten; die neue Funktion benötigt JavaScript. Es wird kein automatischer Wiedergabemodus aktiviert.

## MCP und Validierung

Die lokalen MCP-stdio-Aufrufe sind in `evidence/mcp/interactions.jsonl` und `lightbox-context.json`, `lightbox-contract-context.json`, `lightbox-compile.json`, `lightbox-plan.json` protokolliert. Compile und Plan betreffen die RMT-Erweiterung für den Öffnen-Button/Status, **nicht** einen erfundenen RMT-Carousel-Plan. Der Classic-Adapter wird zusätzlich durch den Produktionsbundler und reale Browser geprüft.

RMT-Source-Hash: `7085cf4f8bf1efb0601286888089b78c3075966457a7ca66f688395e629d5ea7`.

`tests/lightbox.mjs` prüft in Chromium/Firefox: spätes Laden, echte Komponente, initiale Auswahl, alle Treffer der Seite, Umlauf, Sidebar-Synchronisation, Fokus/Scroll, beide Escape-Ebenen, Fehlerbilder, fehlendes Modul, Navigation während des Imports oder bei geöffnetem Dialog sowie schmales Layout und Wischbedienung. Die Bildproxy-Antworten verwenden dieselben ausgewiesenen synthetischen Testmotive wie die Medienprüfung. `TEST_CSS_OVERRIDE` dient ausschließlich der lokalen CSS-Vorschau; für die endgültige Containerprüfung bleibt es ungesetzt und der Report nennt `cssOverride: null`.

Der erste UI-Durchlauf zeigte einen dimensionslosen Custom-Element-Host trotz sichtbarem innerem Overlay; der Host belegt nun bei `open` explizit das Browserfenster. Die Skalierungsanimation des inneren Content-Parts wurde entfernt, damit fest positionierte Controls während des Öffnens nicht ihre Bezugsebene wechseln. Eine frühe Firefox-Fehlersimulation hatte außerdem ein bereits dekodiertes Thumbnail nachträglich als unerreichbar markiert; die korrigierte Fixture setzt den Fehler vor der ersten Bildanforderung. Negative Nachweise bleiben unter `evidence/tests/lightbox/` erhalten.

## Abnahme des finalen Containers

43 Browserfälle (12 Lightbox, 14 Medien, 17 allgemeine Suche/Resume/Fallback/Security) und neun Adapter-Unitprüfungen bestanden. Die finale Lightbox-Prüfung nutzt ausschließlich die aus dem Container ausgelieferten Assets (`cssOverride: null`). Nachweise: `evidence/tests/lightbox/results.json`, `media-regressions.json`, `browser-regressions.json` und `unit.txt`. Desktop- und schmale Ansichten wurden visuell geprüft; echte Mobilgeräte und manuelle Screenreader-Sitzungen waren nicht Teil dieser Prüfung.

Die Skript-Inventur beträgt initial **434,6 KiB gzip**; erst beim Öffnen kommen **7,9 KiB gzip** für Classic-XLightbox und Carousel hinzu (`evidence/builds/lightbox-script-bytes.json`). Das bestehende 150-KiB-Gesamtbudget bleibt verfehlt. Diese Erweiterung ist kein Nachweis eines allgemeinen Performancevorteils; die vollständige Upstream-Timing-/Lastbaseline wurde nicht erneut ausgeführt.

Der Live-Test deckte einen zusätzlichen Fokusfall auf: Bei einem nicht erreichbaren Bild kann der Sidebar-Öffnen-Button fehlen. Die Rückgabe verwendet dann den Sidebar-Schließen-Button; ein erst später auftretender Bildfehler übergibt den Fokus ebenfalls vor dem Entfernen des Buttons. Der gezielte Browserfall deckt diesen Zustand nun ab.

Live-Abnahme: „Mozilla Firefox“, Kategorie Bilder, lieferte 100 echte Treffer mit 100 Vorschaudatensätzen. Die Lightbox öffnete das gewählte Wikimedia-Original vollständig über den Bildproxy; End erreichte Bild 100 und Rechts wechselte von dort zu Bild 1. Die Sidebar folgte, das Dokument blieb identisch und der Fokus kehrte nach Escape korrekt zur Sidebar zurück. Keine Browser-JavaScriptfehler oder direkten Fremdorigin-Requests; Readiness HTTP 200. Nachweis: `evidence/tests/lightbox/live.json`, `live-desktop.png`. Das Live-Skript wartet auf Readiness, bevor die erste Suche startet.
