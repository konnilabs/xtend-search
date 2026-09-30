# XTend.search 0.4.1 – SSR/Resumability-Patch

30. September 2026. Frontend **0.4.1**, Backend unverändert **0.4.0**. Der Patch trennt Framework-Ursachen und App-Integration. Framework-PR: [konnilabs/xtend #84](https://github.com/konnilabs/xtend/pull/84), Commit `9b421fe6df0f9f3e016f87f9f607fbb632a319ef`, Basis `ce40c1b3694438d597661a148fb9f29992a786c2`. Der PR ist offen und nicht gemergt.

## Befunde und Umsetzung

| Befund | Ursache | Patch |
|---|---|---|
| Modell im `input[type]` | Framework: generischer Value-Resolver deutet bloße Attributstrings als Modellpfade; auch portable Projektion löst zu früh auf. | Attributstrings bleiben Literale in DOM, Node-SSR und portabler Node/PHP-Projektion. Explizite Bindings bleiben erhalten. Strukturierte native/ARIA-Werte werden vor Ausgabe mit Diagnose abgewiesen; strukturierte `data-*`-Verträge bleiben kompatibel. |
| HTML-Kopie im Page-Wire | Framework: allgemeine Prerender-Chunks werden vollständig im initialen Dokument mitgesendet. | Nur initiale portable Node-Resume-Dokumente entfernen `markup.html` und `textContent` aus Descriptor-Chunks. Allgemeine SSR-Antworten, HTML-only, Hydrate-Modus und Page-API behalten ihre Verträge. Descriptor und Artifact ermöglichen Recovery. |
| Fehlende `x-section`-Capability | App: Metadaten existieren im SDK, die Page-Hosts registrierten sie nicht. | Standalone-, Admin- und Legacy-Host erhalten das statische Komponentenmanifest und Source-Texte. Browser-Komponenten werden nicht in Node ausgeführt. Ein Framework-Regressionstest prüft die vollständige Core-Registry einschließlich `x-section`. |
| Snapshot und Resume-Abdeckung | Modell-/Reducer-/Event-State wird von Runtime und Recovery konsumiert; beliebiges Löschen ist nicht belegt. | Signierter State unverändert. Neue Node-Metrik `hydration.coverage` sowie Docker-Browsertest mit Byte-/gzip-Messungen und Payload-Grenze. |

**Kompatibilität:** Implizite Modellpfade in Attributen müssen explizite `$model`-/`$item`-Bindings, Interpolation oder Expression-Records verwenden. Der generische Property-/Value-Resolver bleibt unverändert.

Das Framework liefert `xtend.rmt.ssr-coverage.v1`: Descriptor-Elemente, Resume-Markierungen, Component-Nodes, fehlende Capabilities und Raw-HTML-Fragmente. `resumeMarkerCoverage` zählt Markierungen / Descriptor-Elemente. Dies ist **keine erfolgreiche Browser-Resume-Quote**; innere Raw-HTML-Nodes sind nicht enumeriert. Der Browser-Test prüft echte Resume-/Fallback-Ergebnisse getrennt.

## Messung

Lokale Startseite im bisherigen 0.4.0-Image und im neuen Docker-Image; identische Anwendung und Defaultfilter. Dynamische Signaturen und Zeitstempel variieren. Werte sind Transportgrößen und keine Produktionslatenz-Zusage.

| Messung | 0.4.0 | 0.4.1 |
|---|---:|---:|
| HTML-Dokument, Bytes | 200.615 | 80.936 |
| HTML gzip, Bytes | 27.534 | 15.806 |
| Inline-Wire, Bytes | 144.874 | 67.332 |
| Inline-Wire gzip, Bytes | 21.116 | 13.718 |
| Signierter Snapshot-State, Bytes | 44.860 | 44.860 |
| HTML-Kopien in dekodierten Chunks | 2 | 0 |
| Missing-Capability-Diagnosen | 2 | 0 |

Das kompakte Wire wird ungefähr **53,5 % kleiner**, das gesamte HTML ungefähr **59,7 %**. Die neue Startseite hat 70 Descriptor-Elemente mit 70 Resume-Markierungen, zwei Komponenten-Nodes und keine fehlende Capability. Signatur, DOM-Digest, Expiry und Intent-Replay bleiben Bestandteil des Resume-Vertrags.

## Abnahme und Nachweise

- **647 Framework-Assertions**: Node-SSR, DOM-Renderer, Page-Vertrag, Node/PHP-Parität, PHP-SSR und Core-Komponenten-Registry; keine Fehler.
- **29 Chromium-Lifecycle-Assertions**: ECDSA-verifizierter Resume erhält den Server-DOM; manipulierte Signatur rendert weiterhin die Fallback-Ansicht ohne HTML-Kopie.
- **65 App-Tests**: zusätzlich echte kompilierte Such-RMT mit kollidierenden Modellschlüsseln, Registry-Abdeckung und unverändertem kanonischem Resume-State.
- Docker-Browser: echter Maraca-Resume erhält das Suchfeld, falsche Signatur führt zu `fallback_hydrated`; beide Pfade suchen, streamen und navigieren über Back/Forward ohne Dokumentwechsel. Direkte SSR-Suche ohne JavaScript besteht.
- Bestehende 0.4-Funktionen: sechs Observatory-Bereiche, XSurfaceManager/XSidePanel bei 320–3840 px, Formulare und Live-Daten, Rollen/OAuth-Fixture, Qualitätsmeldungen, langsame Favicons, schadhafte Streams, Bildplatzhalter, Preview und XLightbox-Carousel bestanden.
- Echter Nextcloud-Login unverändert; für dieses Patch-Release wurde kein neuer interaktiver Login behauptet.

Nachweise unter `xtend/evidence/control-plane/0.4.1-*`. Aufrufbare XTend-MCP-Tools waren in dieser Sitzung nicht vorhanden; lokales XTend-0.8.0-SDK, Maraca-Compiler und reale Tests wurden verwendet. GitHub-PR wurde mit dem ausdrücklich angefragten GitHub-Plugin angelegt.

## Build und Übernahme des Framework-Patches

`xtend/patches/ssr-resume/manifest.json` hält Version, Upstream-Basis/PR und Vorher-/Nachher-SHA-256 jedes Runtime-Files fest. Beide Maraca-Buildpfade wenden den Overlay vor dem Build an. Der Installer validiert alle Hashes zuerst, arbeitet idempotent und verweigert unpassende SDK-Stände. Der Docker-Export prüft auch die tatsächlichen gepatchten SDK-Dateien im Image. Ein neues `npm ci` verliert die Korrektur daher nicht.

Nach Veröffentlichung einer korrigierten SDK-Version den lokalen Overlay bewusst ablösen und dieselben Gates ausführen. Keine neue Framework-Version wird vorgetäuscht. Das Frontend bleibt auf dem geprüften 0.8.0-Paket.

## Verbleibende Arbeit und Rückweg

Statische View-Daten im benötigten Snapshot wurden nicht blind entfernt. Weitere State-Verkleinerung benötigt eine vertragliche Ableitung der tatsächlich von Reducern, Bindings und Recovery gelesenen Pfade. Eine populationsweite erfolgreiche Resume-Quote würde zusätzliche begrenzte Client-Telemetrie erfordern; sie wird hier nicht behauptet.

Keine Datenmigration und keine Änderung an Freigaben, Schutzfristen, Qualitätsregeln oder dem SearXNG-Core. [Update und Rollback](UPGRADE-0.4.1.md). Produktionsserver wurde nicht verändert.
