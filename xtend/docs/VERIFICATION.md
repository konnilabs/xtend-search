# Prüfprotokoll — XTend.search

Die Rohbelege liegen unter `xtend/evidence/`. Es behauptet keine vollständige Erfüllung aller Forschungsziele des ursprünglichen ADR.

Die folgenden ursprünglichen MVP-Messungen beziehen sich auf 0.1.0. Die zusätzliche 0.2.0-Abnahme für XScaler-Streaming, einschließlich aktueller Image-/Quellhashes und Live-Messungen, steht in `XSCALER-STREAMING.md`; ältere Performancewerte werden nicht als neue Messungen ausgegeben.

## Funktionaler Umfang

| Prüfung | Ergebnis / Beleg |
| --- | --- |
| MCP-Compile und Maraca-Plan der finalen RMT-Quelle | erfolgreich, ohne Diagnostics; `mcp/final-compile.json`, `mcp/final-plan.json` |
| Produktionsbuild mit echten Rollup-/Terser-Werkzeugen | erfolgreich; `builds/build.json`, generierter Maraca-Report |
| URL-/DTO-/Security-Unitprüfungen | 6 bestanden; `tests/search.test.mjs` |
| Chromium + Firefox | 17 Tests bestanden; `tests/browser.json` |
| Signierter Resume | DOM-Identität vor/nach Resume geprüft; kein zusätzlicher initialer Suchfetch |
| Startseite→Ergebnisse | Dokument, Shell und Suchfeld bleiben erhalten |
| Filter, Kategorie, Paging, Back/Forward | Browserprüfungen mit URL- und Ergebniszustand |
| Frühe Eingabe, spätere Antwort, Request-Race | Eingabe-Replay, Entwurfserhalt und „neueste Anfrage gewinnt“ geprüft |
| Native Suche | JavaScript deaktiviert und Module blockiert; Filter/Paging funktionieren |
| Ungültige Signatur | `fallback_hydrated` und anschließende Suche in beiden Browsern geprüft |
| Teil-/Totalausfall und leere Suche | Fixture-Pfad durch den echten Python-Suchkern |
| Host ausgefallen | Gateway HTTP 503; Classic HTTP 200; `tests/host-outage.json` |
| Branding/About | Eigenes SVG/PNG; Attribution auf `/info/de/about` geprüft |
| XSS/URL-Sicherheit | Titel bleiben Text; gefährliche Schemes/Links werden verworfen; private Routen/JSON gesperrt |
| Mobil | 390 × 844, keine horizontale Überbreite in beiden Browsern |

## Bewusst begrenzte Aussagen

- Kein Test auf einem entfernten Server wurde behauptet: die identische Linux-Container-Runtime und eine Serveranleitung werden geliefert. ARM64 ist im Basisimage verfügbar, wurde hier aber nicht ausgeführt.
- Keine behauptete vollständige WCAG-Zertifizierung; native Tastaturbedienung, Labels, Statusregion, Fokus, Skip-Link und mobile Darstellung sind implementiert. Eine Screenreader-Prüfung bleibt offen.
- Engines sind externe Dienste. Live-Fehler einzelner Anbieter sind sichtbar und werden nicht als Frontendfehler verschleiert. Während der ersten Live-Probe: 45 Treffer und ein SSL-Fehler von DuckDuckGo.
- Keine abgeschlossene öffentliche Betriebsfreigabe: Auth/Rate-Limiter/TLS müssen für die konkrete Serverumgebung konfiguriert werden.
- Zum ursprünglichen MVP waren Spezialkarten, weitere Kategorien/Sprachen, kontobezogene Preferences und inkrementelles Ergebnisstreaming Follow-ups. Wissenskarten und XScaler-Streaming wurden später ergänzt; siehe die Erweiterungsprotokolle.
- Kurze Lasttests bei Concurrency 1/5/20 sind enthalten; eine mehrstündige Speicher-/Leakprüfung, eine Live-U/X-Vergleichsreihe und Feld-INP sind noch offen. Labormessungen dürfen diese nicht ersetzen.

## Gemessene Performance

Lokale Prozesse auf demselben Ubuntu-Rechner, identische Fixture mit 50 Texttreffern und 40 ms Enginewartezeit, derselbe Gateway mit gzip. Pro Profil/Cache/Variante 5 Warm-ups und 30 gewertete Aufrufe. 420 gewertete Messungen einschließlich 60 SPA-Navigationen. Chromium 145; langsames Profil: CPU-Faktor 4, CDP-Latenz 40 ms, Download 1.25 MB/s, Upload 0.625 MB/s. Hintergrundprogramme des Arbeitsplatzes liefen weiter; dies ist eine reproduzierbare lokale Labormessung, kein isolierter Serverbenchmark.

| Profil / Cache | Variante | TTFB p95 | LCP p75 | Bereit p95 |
| --- | --- | ---: | ---: | ---: |
| desktop / cold | U | 77 ms | 128 ms | – |
| desktop / cold | X0 | 146 ms | nicht erhoben | – |
| desktop / cold | X1 | 140 ms | 192 ms | 439 ms |
| desktop / warm | U | 83 ms | 124 ms | – |
| desktop / warm | X0 | 143 ms | nicht erhoben | – |
| desktop / warm | X1 | 142 ms | 192 ms | 436 ms |
| slow / cold | U | 79 ms | 236 ms | – |
| slow / cold | X0 | 139 ms | nicht erhoben | – |
| slow / cold | X1 | 142 ms | 288 ms | 1585 ms |
| slow / warm | U | 81 ms | 164 ms | – |
| slow / warm | X0 | 143 ms | nicht erhoben | – |
| slow / warm | X1 | 146 ms | 296 ms | 1614 ms |

U = originales Upstream-Frontend; X0 = XTend ohne JavaScript; X1 = XTend mit gültigem Resume. Die Rohdatei enthält bei X0 für unbeobachtete LCP/CLS/Long-Task-Werte Nullen; diese sind **keine Messnachweise**. FCP/Navigation-Timing wurden direkt über Browser-Performance-Einträge gelesen.

| Größe | Ergebnis |
| --- | ---: |
| Initialer JS-Graph, 22 Dateien | 2341.9 KiB raw / 429.9 KiB gzip / 339.4 KiB Brotli |
| Zusätzliches App-CSS | 2.8 KiB gzip |
| SSR-HTML mit 50 Treffern | 55.2 KiB komprimiert |
| Upstream-HTML mit 50 Treffern | 8.7 KiB komprimiert |
| SPA, desktop: Navigation p95 / Antwortende→Commit p95 | 99.6 ms / 37.3 ms |
| SPA, slow: Navigation p95 / Antwortende→Commit p95 | 314.2 ms / 246.6 ms |

**Bewertung: funktional gelungen, Performancevorteil nicht belegt.** JS-Budget 150 KiB gzip verfehlt. Zusätzliche p95-TTFB im Desktop/Kaltprofil rund 63 ms gegenüber Ziel 50 ms ebenfalls darüber; die Messgröße enthält die gesamte Gateway-/Core-/SSR-Kette und ist keine isolierte reine SSR-CPUzeit. Desktop-Antwortende→Commit liegt unter 100 ms. LCP p75 hält im Desktopprofil das vorläufige U+100-ms-Ziel ein; das warme langsame Profil liegt darüber. Beobachteter CLS im X1-Ergebnisprofil: 0. Die gemessene Pending-Event-Latenz ist ausdrücklich **nicht** gleichbedeutend mit einer nachgewiesenen sichtbaren Ladebestätigung; für dieses Gate fehlt eine eigene Paint-Messung.

Root-Cause: Der initial geladene `xtendrmt-runtime.esm.mjs` beansprucht allein rund 202 KiB gzip, der Maraca-Entry weitere 104 KiB; dazu kommen Page Client und Plan-Runtime. `lazy: component` vermeidet andere Komponenten, trennt aber diesen Basisgraph nicht ausreichend. Ein bloß kleiner Bootstrap würde die realen Kosten verschweigen. Follow-up: kleinere RMT-Kernel-/Page-Composition-Grenzen im Framework, Deduplizierung gemeinsamer Runtime-Abhängigkeiten, anschließend dieselbe Messreihe wiederholen. Keine nachträgliche Anhebung des Budgets.

Das 10-Treffer-Seed-Budget wurde in dieser Reihe nicht separat geprüft (hier 50 Treffer). Die vollständigen Rohdaten und JS-Einzeldaten liegen in `evidence/tests/performance.json`; der Messcode unter `tests/benchmark.mjs`.

## Kurzer Lasttest

Gleiche lokale Prozesse, 50 Treffer, 30 Requests pro Zeile. Keine vollständige Serverkapazitäts-/Leakfreigabe.

| Variante | Gleichzeitige Requests | Requests/s | p95 | Fehler |
| --- | ---: | ---: | ---: | ---: |
| upstream | 1 | 13.9 | 78 ms | 0 |
| upstream | 5 | 35.0 | 221 ms | 0 |
| upstream | 20 | 34.9 | 546 ms | 0 |
| xtend | 1 | 7.6 | 142 ms | 0 |
| xtend | 5 | 12.4 | 554 ms | 0 |
| xtend | 20 | 15.3 | 1276 ms | 0 |

Die zusätzliche Node-/SSR-Schicht senkt hier den Durchsatz. Das bestätigt die noch offene Performancefreigabe. Details zur Reproduktion: `BASELINE.md`.

## Container-Abnahme

Linux/amd64, Docker Engine 29.1.3, Compose 5.5.0; real gebaut und gestartet. Image `sha256:786d8139b0448f33be8179ba6ef46c1eba1ea80343d18dfa819f388388223e24`, 631.9 MiB. Standard-Compose-Konfiguration syntaktisch geprüft. Nicht als Fremdserver- oder ARM-Test ausgeben.

- Finale Fixture-Instanz im Container: dieselben **17 Browserprüfungen bestanden**.
- Danach Live-Profil aktiviert, Fixture-Marker false; **37 Webtreffer**, **96 proxierte Bild-Thumbnails**, kein Browser-Seitenfehler und kein externer Browserrequest während der Suche. Zwei Engine-Teilausfälle wurden korrekt angezeigt.
- Resume-Status `resumed`; gleiche Dokumentinstanz über die Suche hinweg; About und Source-Download HTTP 200.
- Container gesund, läuft als UID/GID 10001 mit read-only Root und ohne Capabilities. Nur 127.0.0.1:8080 veröffentlicht.
- Private Resume-Datei existiert ausschließlich im Secret-Volume; Quellarchiv enthält weder Secrets noch node_modules, jedoch den exakten XTend-Tarball.
- MCP-Source-Hash und tatsächlicher Docker-Build-Source-Hash stimmen überein.

Aktuell laufende Instanz: `http://localhost:8080`. Compose-Befehle und Serverbetrieb siehe `README-XTEND.md`.

## Ergänzende Medien-Erweiterung

Wissenskarten und Bildvorschau sind nach der ursprünglichen MVP-Abnahme hinzugekommen. `MEDIA-SURFACES.md` enthält den aktuellen Funktionsumfang, 39 erneut bzw. zusätzlich bestandene Browserfälle, Live-Nachweise und die aktualisierte Skript-Inventur von 433,8 KiB gzip. Die obigen Timing- und Lastmessungen bleiben Messungen des ursprünglichen MVP-Stands.

## XAlert-Erweiterung

14 gezielte Browserfälle, 17 allgemeine Such-/Resume-/Fallback-/Security-Fälle und neun Adapter-Unitprüfungen bestanden. Details, negative Vorläufe und Grenzen: `ALERTS.md`. Die aktuelle Skript-Inventur beträgt initial 439,7 KiB gzip, plus 7,9 KiB für die optionale Lightbox. Der Performance-Gate bleibt offen.

## Bildfallback und Vorschau-Erholung

Nicht erreichbare Bilder erhalten lokale Platzhalter; pro Anforderung zugeordnete Fehler können keine spätere Auswahl überschreiben. Die 14 gezielten Chromium-/Firefox-Fälle einschließlich verzögerter Fehler und Erholung sind bestanden, ebenso neun Unitprüfungen. Details und Grenzen: `IMAGE-FALLBACK.md`. Neue Skript-Inventur: initial 441,2 KiB gzip, weitere 8,0 KiB bei Lightbox-Öffnung; Performance-Gate weiterhin offen.
