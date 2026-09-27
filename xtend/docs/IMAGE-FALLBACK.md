# Bildfehler: Platzhalter und unabhängige Vorschau-Anforderungen

Nicht ladbare Trefferbilder erhalten das lokale, mit Hell-/Dunkelmodus arbeitende `image-placeholder.svg`. Titel und Original-/Quelllinks bleiben erhalten; Auflösungsangaben werden auf Platzhalter-Kacheln ausgeblendet. Bei komplett fehlgeschlagener Sidebar-Vorschau erscheint dieselbe Grafik zusätzlich zur vorhandenen Erklärung. Ist nur das Original nicht erreichbar, bleibt die bisherige Ersatzstrategie über das Thumbnail erhalten. Die Vollbildansicht zeigt ebenfalls einen Platzhalter und erlaubt weiteres Blättern.

## Zuständigkeiten

- `frontend/images.mjs` erfasst Thumbnailfehler einschließlich bereits vor dem Resume gescheiterter SSR-Bilder. Es sammelt Fehler pro Suchantwort, bündelt Aktualisierungen mit `requestAnimationFrame` und projiziert die geänderte Trefferliste über `search.images.set`. Die ursprünglichen Page-Props bleiben unverändert, damit ein Platzhalter nicht zum eigentlichen Bildziel wird. Nach einer neuen Antwort werden die Originalquellen wieder eingesetzt, auch bei identischer Suchanfrage. Es gibt keine anhaltende Sperrliste oder Nutzerdaten-Speicherung.
- Bilder im Grid bekommen einen RMT-Key aus ihrer dargestellten Quelle; geladene oder noch ladende Bilder werden nicht durch ein altes Fehlerereignis als gescheitert markiert. Quellfehler werden nicht bei jedem Filterentwurf oder Preview-Update neu angefragt.
- `frontend/preview.mjs` ordnet jeder Original-/Thumbnail-Anforderung eine eigene Kennung, Quelle, Auswahl und Generation zu. Das RMT-Bild besitzt denselben Key und `data-image-request`. Ein Fehler wird nur für das aktuelle, verbundene Bild und genau einmal verarbeitet. Ein neuer Versuch ersetzt die alte Zuordnung; Schließen und Navigation verwerfen sie. Damit können verspätete oder doppelte Fehlerereignisse nicht das nächste Bild ausblenden.
- `frontend/lightbox.mjs` prüft Quelle und tatsächlichen Ladezustand, setzt nach ausgeschöpftem Fallback den lokalen Platzhalter und behält die Fehlermeldung. Jeder Carousel-Wechsel startet mit frischem Fehler-/Ladezustand.
- `search.rmt` bleibt Eigentümer von Grid und Sidebar. Es wurden weder der Python-Suchkern, der signierte Bildproxy noch SDK-Dateien verändert. Der Produktionsbuild kopiert die eigene SVG-Datei in die ausgelieferten Assets.

## Grenzen und Diagnose

Ein HTTP 403 ist zunächst eine Ablehnung der konkreten Bildanforderung; allein daraus folgt nicht sicher, dass Hotlink-Schutz die Ursache ist. Der Proxy reicht den Fehlerstatus weiter. Eine entsprechende Browser-Netzwerk-/Konsolenmeldung kann deshalb weiterhin erscheinen. Die Shell fängt die Darstellung und den UI-Zustand ab; sie umgeht keine Zugriffsbeschränkungen und lädt keine Fremdquelle direkt im Browser.

Die dynamische Ersetzung benötigt JavaScript. Ohne JavaScript bleiben die nativen Bild-/Quelllinks nutzbar; eine nicht ladbare Vorschau kann dort weiterhin als Browser-Platzhalter erscheinen. Die lokale Ersatzgrafik wird nur einmal als Asset geladen und trägt keine Remote-Referenzen.

Das vom Nutzer berichtete vollständige Festhängen ließ sich vor dem Fix weder mit einem einfachen simulierten 403-Fall noch beim Wechsel zwischen mehreren realen gesperrten Ubuntu-Bildern zuverlässig reproduzieren. Die vorherige Fehlerbehandlung unterschied jedoch keine einzelnen Bildanforderungen und verwendete nachträglich den global aktuellen Auswahlzustand. Die Änderung sichert diesen Fehlerpfad gezielt ab. Die neuen Tests prüfen tatsächliche Erholung sowie künstlich verspätete/doppelte Ereignisse; daraus wird keine vollständige Ursachenbestätigung für den ursprünglichen Einzelfall abgeleitet.

## Reproduktion und Evidenz

`tests/image-fallback.mjs` verwendet die explizite Python-Fixture auf Port 8090. Browser-Routen simulieren 403/404/502, eine ungültige Bilddatei trotz HTTP 200 sowie verzögerte Antworten. Erfolgreiche Antworten enthalten gekennzeichnete synthetische Testbilder. Die Cache-Header entsprechen dem `no-store`-Vertrag des echten Gateways. Keine Tests überschreiben die ausgelieferten App-Assets.

Die Prüfungen decken frühen SSR-Fehler, stabile Thumbnail-Platzhalter, erhaltene Links, mehrere defekte Bilder hintereinander, Pfeiltasten/anderen Treffer/Schließen, verzögerte und doppelte Fehler, Original-zu-Thumbnail-Fallback, das Vollbild-Carousel, identische neue Suche sowie schmale Hell-/Dunkelansichten ab. MCP-stdio-Evidenz: `image-fallback-context.json`, `image-fallback-compile.json`, `image-fallback-plan.json` und `interactions.jsonl`. Es werden öffentliche RMT-Actions und dynamische Element-Keys verwendet; keine neue Komponenten-API wird vorausgesetzt.

## Abnahme

14 gezielte Fälle in Chromium/Firefox bestanden (`evidence/tests/image-fallback/results.json`), dazu neun Adapter-Unitprüfungen. Bestehende Medien- und Lightbox-Regressionsnachweise liegen im selben Evidenzordner. Der erste Durchlauf ist als `first-run.json` erhalten; er zeigte einen Wiederholungsfall in Firefox. Thumbnail-Identität und Prüfung des tatsächlichen Ladezustands wurden abgesichert, und die simulierten Bildantworten verwenden nun wie das Gateway `Cache-Control: no-store`. Mobile Dunkel-/Hellansichten wurden visuell geprüft.

RMT-Quellhash: `e37553d09019827472d0891c24e13a32b1442b38d992f6780d26e23e986b086c`.

Die Skript-Inventur beträgt jetzt **441,2 KiB gzip initial** und zusätzlich **8,0 KiB gzip** beim Öffnen der Lightbox (`evidence/builds/image-fallback-script-bytes.json`). Das 150-KiB-Ziel bleibt verfehlt; kein neuer Timing-/Lastvergleich.

Die finalen Regressionen sind ebenfalls bestanden: 14 Medienfälle und 12 Lightbox-Fälle. Zusammen mit den 14 gezielten Fällen sind dies 40 Browserprüfungen. Die Quellhashes von RMT, Thumbnail-Adapter, Preview-Adapter und SVG stimmen zwischen lokalem Quellbaum und Container überein.

Live-Abnahme auf Port 8080: Die echte Bildsuche „ubuntu“ zeigte den lokalen Ersatz für gesperrte Bildquellen. Nach Auswahl eines solchen Treffers konnte in derselben Sidebar ein erreichbares Ubuntu-Bild geöffnet und anschließend in XLightbox vergrößert werden; das Dokument blieb identisch. Keine JavaScript-Ausnahmen und keine direkten Fremdorigin-Anfragen. Tatsächliche Bildproxy-HTTP-Fehler bleiben als Netzwerkdiagnose erfasst. Nachweis: `evidence/tests/image-fallback/live.json` und `live-grid.png`, `live-unavailable.png`, `live-recovered.png`. Container `f21706114903` ist healthy; die isolierte Fixture-Instanz wurde entfernt.
