# Wissenskarten und Bildvorschau — 19.09.2026

Status: implementierte Erweiterung des XTend.search-MVP. Eigene Wortmarke, Farben und Oberfläche bleiben erhalten. SearXNG liefert Suchergebnisse und Infoboxen; XTend/Maraca rendert die Oberfläche und hält ihren Zustand. Keine React-/Vue-Schicht und kein kopiertes Upstream-JavaScript.

## Funktionsumfang

**Knowledge Cards:** Beschreibungen, Bild, Fakten, Quellenlinks und verwandte Suchbegriffe aus SearXNGs `infoboxes`. Auf breiten Bildschirmen rechts neben Webtreffern, auf kleinen Bildschirmen oberhalb der Treffer. Karten gehören zum initialen SSR-Dokument und funktionieren ohne JavaScript. Eine reine Infobox-Antwort wird als gültiges Ergebnis dargestellt. Ob eine Karte erscheint, hängt von den aktivierten Engines, deren Antwort und der konkreten Suchanfrage ab; fehlende Fakten werden nicht ergänzt oder erfunden.

**Bildvorschau:** Klick auf ein Thumbnail öffnet ein breites Seitenpanel im selben Dokument. Das Raster markiert den ausgewählten Treffer. Vor/Zurück und Pfeiltasten blättern innerhalb der aktuellen Ergebnisseite; an den Grenzen sind die entsprechenden Schaltflächen deaktiviert. Escape und die Schließen-Schaltfläche schließen das Panel und geben den Fokus an den ausgewählten Bildlink zurück. Titel, Beschreibung, Quelle, Original-Link und vorhandene Metadaten/Formate erscheinen unter dem Bild. Auf schmalen Bildschirmen steht das Panel im normalen Seitenfluss vor dem Raster. Es ist eine benannte, nicht modale Region ohne Fokusfalle.

Das Panel ist flüchtiger UI-Zustand. Eine neue Suche, Kategorie, Seitennavigation oder History-Navigation schließt es; die Such-URL bleibt die kanonische Adresse. Das Öffnen einzelner Bilder erzeugt keine zusätzlichen History-Einträge. Direkt verlinkbare Bildauswahl ist ein mögliches Follow-up.

## Datenvertrag und Datenschutz

- Der bestehende private Header aktiviert die Darstellungsergänzung nach Upstreams JSON-Serialisierung; Suchparser, Engines, Ranking und Plugins bleiben erhalten.
- `xtend_integration.py` ergänzt signierte Proxy-Adressen und wandelt HTML aus Infobox-Beschreibungen/Fakten über SearXNGs vorhandenen Text-Extractor in Text um. Keine Ausführung oder direkte Übernahme von Provider-HTML.
- Der Node-Adapter begrenzt auf drei Karten, 20 Fakten, zwölf Quellen und zwölf verwandte Begriffe. Quellen und Original-Links akzeptieren nur HTTP(S) ohne eingebettete Credentials. RMT rendert untrusted Inhalte als Text.
- Bilder unterschiedlicher Original-URLs behalten auch bei gleicher Quellseite getrennte Identitäten. Dadurch verschwinden keine legitimen Bildtreffer durch URL-Deduplizierung.
- Eingebundene Karten-, Thumbnail- und Vorschaubilder verwenden ausschließlich signierte Same-Origin-`/image_proxy`-URLs. Der Browser lädt keine externen Fonts, Favicons oder Bilder direkt. Ein bewusster Klick auf Quelle oder Original verlässt die Instanz.
- Originalbilder werden erst beim Öffnen des Panels angefordert. Bei Ladefehlern versucht die Shell das Thumbnail und zeigt danach nötigenfalls eine verständliche Meldung. Original-/Quelllinks bleiben verfügbar.
- Ohne JavaScript oder vor erfolgreichem Bootstrap sind Bild-Thumbnails normale Links zum Original; Trefferüberschriften verweisen auf die Quellseite. Modifizierte Klicks behalten die Browserfunktion.

## XTend-, RMT- und MCP-Nachweise

`frontend/search.rmt` enthält Kartenprojektion, Panelprojektion und den Zustand `search.preview` samt Open-/Close-/Error-Actions. `frontend/preview.mjs` übersetzt Browserereignisse in Commands, wählt bereits normalisierte Treffer und verwaltet Fokus/Ladefehler. Es erzeugt kein Ergebnis-HTML und implementiert keinen zweiten Router. Der bestehende Pending-Command verwirft die Bildauswahl vor der nächsten Ergebnisauslieferung.

Der vorhandene lokale MCP 0.8.0/Hydrangea wurde erneut tatsächlich über MCP-stdio verwendet:

- `evidence/mcp/media-context.json`: gezielter Framework-Kontext.
- `evidence/mcp/media-compile.json`: erfolgreicher Compile-Check ohne Diagnosen.
- `evidence/mcp/media-plan.json`: erfolgreicher Maraca-Plan ohne Diagnosen.
- `evidence/mcp/interactions.jsonl`: Eingaben, Zeitpunkte, Dauer, Provenance und Rohantworten.

RMT-Source-SHA-256: `6f99e3d32b0daba46569758dd1b583fea81f40d79843f75a144a4115d5b30dd8`. Docker baut über dieselbe SDK-Compilation-Session und das bereits gepinnte lokale XTend-Paket. Der lokale Framework-Checkout wurde nicht verändert.

Ein konkreter Integrationsbefund: Wahrheitswerte in benutzerdefinierten DOM-Attributen wurden im SSR als `"true"`, bei einer Client-Aktualisierung als leeres vorhandenes Attribut gerendert. Wertselektoren verhinderten deshalb zunächst das Desktop-Panel und die Auswahlmarkierung. Präsenzselektoren beheben das, ohne Runtimeänderung. Compile-/Plan-Erfolg hatte diesen UX-Fehler nicht erkannt; echte Browserprüfungen waren nötig. Die negative erste Testrunde bleibt in `media-initial.json` erhalten. Eine weitere Runde enthielt eine zu frühe Testassertion vor dem asynchronen Close-Commit; der Test wartet jetzt auf den sichtbaren Endzustand (`media-before-async-test-fix.json`).

## Prüfungen

Neun Unitprüfungen sowie 39 Browserprüfungen bestanden:

| Bereich | Prüfung | Nachweis |
| --- | --- | --- |
| Adapter | Sichere Quellen/Formate, Infobox-only, Metadaten, unterschiedliche Bilder derselben Quellseite | `tests/search.test.mjs` |
| Neue Ansichten | 14 Fälle: Chromium/Firefox, SSR-Karten, Quellen/Fakten, Back, verzögertes Original-Laden, Panel ohne Dokumentwechsel, Tastatur, Fokus, Grenzen, Navigation, Bildladefehler | `evidence/tests/media.json` |
| Responsive | Karten/Panel bei 390 und 900 px ohne horizontalen Overflow; Desktop nebeneinander, Hell/Dunkel; Screenshots visuell geprüft | `evidence/tests/*knowledge*.png`, `*preview*.png` |
| Progressive Enhancement | Karten ohne JS lesbar, native Bildlinks, keine vorgezogenen Original-Anfragen | `evidence/tests/media.json` |
| Bestehende Funktionen | 17 Such-/Resume-/History-/Fallback-/Security-Fälle erneut bestanden | `evidence/tests/browser.json`, `media-regressions.log` |
| Vorherige Fehlerkorrekturen | Acht Fälle für Bilder-Vorwahl und Dark Mode mit/ohne JS erneut bestanden | `evidence/tests/media-shell-regressions/results.json` |

Die neue Test-Engine-Erweiterung greift ausschließlich für `media…`-Suchbegriffe im expliziten Fixture-Profil. Die Bilder liegen absichtlich auf einer reservierten Testdomain. Der Browsertest ersetzt nur deren Bildproxy-Antworten durch reproduzierbare SVG-Motive; die echte Python-Engine, Anreicherung, Adapter, SSR, Signaturprüfung, Resume und Navigation bleiben im Test aktiv. Kein Fixture wird als Live-Ergebnis ausgegeben. Geprüft wurden Desktop-Chromium und Firefox, keine echte Mobilgeräte- oder Screenreader-Sitzung.

## Performance, Betrieb und Rückweg

Die Kaltstart-Inventur der tatsächlich angeforderten Skripte beträgt jetzt **433,8 KiB gzip** (vorher dokumentiert: 429,9 KiB). Das 150-KiB-Ziel bleibt verfehlt. Die Erweiterung beansprucht circa 3,9 KiB zusätzliche komprimierte Skriptdaten; dies ist eine Byte-Inventur, keine erneut durchgeführte TTFB-/LCP-/Lastvergleichsreihe. Nachweis: `evidence/builds/media-initial-scripts.json`. Die kleinere Datei `media-page-graph.json` umfasst nur den Page-Einstieg und dessen Chunks, nicht die gesamte Maraca-Laufzeit; sie darf nicht als Gesamtbudget verwendet werden.

Der Docker-Build verwendet unverändert `Dockerfile.xtend` und `compose.xtend.yml`. Die isolierte Fixture-Instanz wurde auf Port 8090 geprüft, danach die bestehende Live-Instanz auf 8080 aktualisiert. Schlüssel bleiben im bestehenden Volume. Der gebrandete Classic-Pfad und der Rückweg `FRONTEND_MODE=classic` bleiben erhalten. Bei JS-Ausfall funktionieren Karten und native Bildlinks; bei fehlender Infobox antwortet die normale Ergebnisliste. Streaming bleibt unverändert ein Follow-up.

## Live-Abnahme

Auf `http://127.0.0.1:8080` lieferte „Mozilla Firefox“ mit Sprache Deutsch 39 Webtreffer und eine echte Karte „Mozilla Firefox“ einschließlich Bild und Wikipedia-Quelle. Der Wechsel zu Bilder blieb im selben Dokument; 100 dargestellte Bildtreffer enthielten Vorschaudaten. Das Wikimedia-Motiv „About Mozilla Firefox dialog in Interlingua 01“ wurde im Panel vollständig über den Bildproxy geladen. Keine Browser-JavaScriptfehler oder direkten Fremdorigin-Requests; Readiness HTTP 200. Nachweise: `evidence/tests/media-live.json`, `media-live-web.png`, `media-live-preview.png`.

Ein erster Live-Durchlauf überschritt beim Kategorienwechsel die 15-Sekunden-Testgrenze; die Wiederholung mit 30 Sekunden Testgrenze funktionierte ohne Produktänderung. Ein nicht erreichbares Kunstarchiv-Motiv bestätigte außerdem den vollständigen Bildfehler-Fallback (`media-live-unavailable-image.json`). Die externe Wikidata-Engine meldete einen Teilausfall; die Wikipedia-Karte und andere Ergebnisse blieben verfügbar. Keine Behauptung, dass jede externe Bildquelle erreichbar ist.

## Nachtrag: Ergebnisanzeige und Pfeilausrichtung

Nach einer clientseitigen Navigation wurde die Trefferzahl zusätzlich in die Ladeanzeige geschrieben. Der erfolgreiche Abschluss leert jetzt diese Statuszeile; die sichtbare Zahl bleibt ausschließlich in der Ergebnisüberschrift. Diese trägt `aria-live="polite"` und `aria-atomic="true"`, damit aktualisierte Zahlen weiterhin für assistive Technik angekündigt werden können. Lade- und Fehlermeldungen behalten ihre eigene Statusregion. Die reservierte Höhe bleibt erhalten, um unnötige Layoutsprünge zu vermeiden.

Die Vor-/Zurück-Schaltflächen der Bildvorschau verwenden geometrisch zentrierte CSS-Pfeile statt Schriftzeichen mit schriftabhängiger Grundlinie. Button-Größe, zugängliche Bezeichnungen, Fokus und deaktivierte Zustände bleiben erhalten. MCP-Compile-/Planantworten: `evidence/mcp/ui-polish-*.json`; gezielte Browsernachweise: `evidence/tests/ui-polish/`.

### Korrektur der Pfeilspitze

Die CSS-Pseudoelemente erbten die allgemeine `box-sizing`-Regel nicht. Ihre Randstärken vergrößerten die Pfeilspitze und verschoben deren Mitte um einen Pixel gegenüber dem Schaft. Explizites `box-sizing: border-box` am Spitzenelement bringt beide auf dieselbe vertikale Mitte (8 px im 16-px-Symbol). Mit dem tatsächlichen Stylesheet und Button-Markup in Chromium und Firefox, jeweils Hell/Dunkel, visuell geprüft; Nachweis unter `evidence/tests/arrow-tip/`. Ausschließlich CSS geändert, RMT und Laufzeit unverändert.
