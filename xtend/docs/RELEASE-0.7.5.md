# XTend.search 0.7.5 — Stabile Teilantworten und ruhigere Vorschauen

Eine bereits eingegangene Knowledge Card blieb bisher nicht nutzbar, wenn anschließend alle normalen Webquellen scheiterten: Der Abschluss behandelte fehlende Webtreffer als Gesamtfehler. 0.7.5 erhält die Card und zeigt den Ausfall der Webquellen getrennt daneben. Die gleichen normalisierten Daten dienen SSR, No-JS, Streaming und Tab-Cache. Quellenfehler werden weiterhin sichtbar; eine Card wird nicht als Webtreffer gezählt.

## Stream und Zustandsführung

- Jede Provider-Ausführung wird gegen den gemeinsamen Abbruch gesichert. Unerwartete Rejections und Fehler in der Reservierung/Beobachtung bleiben auf eine Quelle begrenzt. Auch ein fehlschlagendes Suchplanning gibt den Zulassungsslot frei. Ein fehlerhafter Adapter kann den Abschluss nicht unbegrenzt blockieren; verspätete Rejections werden konsumiert.
- Private JSON-Antworten müssen den erwarteten Medientyp, gültiges UTF-8 und begrenzte Größen einhalten. Fehlerpfade schließen Response-Streams. URL-Sicherheit, Engine-Zuordnung und native Sperrfristen bleiben verbindlich.
- Vollständige App-Service-Frames brauchen geprüfte Ergebnisdaten und einen passenden Summary-Abschluss. Abgeschnittene oder fehlerhafte NDJSON-Streams behalten bereits angezeigte Daten, beenden den Spinner und werden nicht gecacht. Das SDK besitzt weiterhin NDJSON-Framing, Sequenzprüfung und Backpressure.
- Ergebnis-Auswahl ist eigener RMT-State. Lokale Auswahlintents lesen erst bei serialisierter Action-Ausführung den aktuellen Zustand; sie überschreiben keine wachsende Ergebnisliste. Checkboxen und rote Hervorhebung werden direkt aus ausgewählten Schlüsseln abgeleitet. Dies behebt das im 0.7.4-Interaktivitäts-PoC gefundene Flackern während weiterer Batches.

## Vorschau und Gestaltung

Die Bild-Sidebar reserviert einen 20-Pixel-Slot unmittelbar links der Pfeile. Ein monochromer XSpinner zeigt dort Bild- und Vollbild-Ladevorgänge; Titel, Pfeile und Detailbereich behalten ihre Position. Bildrequests und Lazy-Lightbox-Import erhalten eine begrenzte Wartezeit, korrelierte Abschlüsse und einen terminalen Fehlerzustand. Alte Bildereignisse dürfen den Spinner einer neueren Auswahl nicht beenden. Die native vollflächige XSearchLightbox mit Carousel und Ergebnislinks bleibt erhalten. Es gibt keine HTML-Injektion oder Änderung des SDK.

Der About-Backdrop folgt der warmen CCS-Palette. Wettertemperatur und Zustands-SVG skalieren anhand der tatsächlichen Kartenbreite. Die Stundenansicht verwendet eine Thermometer-/Tropfen-Legende pro sichtbarer Zeile; dieselben CSS-Containerbedingungen bestimmen sowohl die Spaltenzahl als auch die Legenden. Kleine Ansichten bleiben horizontal bedienbar. Tagesprognose und zugängliche Wertebeschreibungen bleiben erhalten. Celsius/Fahrenheit verändert keine Providerabfrage.

## Geprüfter SearXNG-Wechsel

Der Pin wechselt von `9f042d2f67666f86204d6874488880a23ba81a8f` auf den veröffentlichten Snapshot [`629368e40c2aa4edffb05636a8bbc23d2eaa5923`](https://github.com/searxng/searxng/commit/629368e40c2aa4edffb05636a8bbc23d2eaa5923), Version `2026.10.23+629368e40`. Die nachfolgende Master-Änderung am 24. Oktober enthält Übersetzungen. Relevante Änderungen sind Brave-Parsing eingebetteter Daten, DuckDuckGo-Einträge ohne URL, Fehlerbehandlung einzelner weiterer Engines und certifi 2026.10.19. Der digest-gepinnte Node-Laufzeitstand wechselt auf die Sicherheitsversion 24.22.1 (eingebautes Undici 7.30.1). Die App-Lockdatei aktualisiert das separate Undici-Paket auf 8.12.3, einschließlich der Korrektur für [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c). Die lokale Simple-Client-Lockdatei aktualisiert zusätzlich fast-uri auf 3.1.9; der Simple-Client ist nicht die ausgelieferte XTend-App.

Der private `engine-json-v1`-/`engine-health-v1`-Vertrag, authentifizierte Routen, Filterprüfung und Providerfreigaben bleiben erhalten. Acht Python-Vertragstests laufen im neuen Backend mit `--network none`, einschließlich negativer Brave-Parserkontrollen ohne JavaScript-Ausführung. Das ist kein Nachweis über die momentane Verfügbarkeit oder Relevanz externer Suchanbieter. Review, Commits und Grenzen stehen in `evidence/upstream-searxng/2026-10-24.json`.

## Prüfung und Nachweise

- 160 Node-Tests und zehn Legacy-Tests; Strict-Maraca für Search und Observatory inklusive App Services, SSR-Capabilities und HTML-Sicherheitsprüfung.
- Docker-Browser-Gates für frühe Interaktivität/Auswahl, korrelierte Preview-Spinners, XSearchLightbox, Stream-Abbruch, fehlerhafte Frames, neue Generationen und den konkreten Fall „Card zuerst, drei Webfehler danach“.
- Bestehende Gates für Melde-Assistent, Admin-Drafts/SSO, Quellenfreigaben, Cache/History, Filter, Startseiten-Morphing, Bilder, Favicons, Wetter, SSR und No-JS.
- Responsive Wetterprüfung von 320 bis 3840 Pixeln, zusätzlich 1034 und 1186 Pixel; beide Farbschemata, Celsius/Fahrenheit und No-JS. Gemessene Layoutsprünge und Requestzähler werden in den versionierten JSON-Nachweisen aufbewahrt.
- Performanceprüfungen verwenden identische Offline-Provider mit 100/700/2500 ms, verzögerte Favicons und eine zusätzliche langsame Mobilverbindung. Ergebnisse sind lokale Messungen, keine Produktions-Latenzzusage.

Der tatsächlich verwendete lokale XTend-MCP liefert versioniertes Wissen über zwei Lese-Tools. Request, relevante Antwort und Entscheidungen stehen in `evidence/control-plane/0.7.5-mcp.json`. Compiler-, Build- und Browsernachweise stammen getrennt vom gepinnten SDK/CLI. Das SDK bleibt 0.9.0 aus Commit `66ffa8fa4423134e99705b3d3dd0d1568a8dbdb3`; siehe `vendor-inputs/xtend-0.9.0-provenance.json`.

## Lokaler Vergleich mit 0.7.4

Je fünf Läufe pro Version am selben Host mit frischen, getrennten Fixture-Volumes und identischen 100/700/2500-ms-Providern. Mediane; kleine lokale Stichprobe:

| Messung | 0.7.4 | 0.7.5 |
| --- | ---: | ---: |
| Erster Ergebnis-Paint | 611,7 ms | 638,8 ms |
| Streamabschluss | 3209,3 ms | 3238,3 ms |
| Cache-Wiederherstellung | 749 ms | 784 ms |
| Gesamter Search-Browsergraph, gzip | 136759 Byte | 137368 Byte |
| Grob gerundeter Chromium-JS-Heap | 18,2 MB | 19,3 MB |

Der erste Paint liegt damit 4,4 % höher, innerhalb des 10-%-Budgets. Der Browsergraph wächst um 609 Byte gzip; diese Summe enthält auch dessen Lazy-Chunks. Das ist von den tatsächlich übertragenen, im Browser gemessenen Modulbytes getrennt. Die Heap-Messung ist eine grobe Diagnose und kein Nachweis über langfristig gehaltenen Speicher. Alle Vergleichsläufe erreichen CLS 0 und restaurieren ohne neuen Suchstream. Vollständige Einzelwerte, Graphgrößen und methodische Grenzen: `evidence/control-plane/0.7.5-performance-comparison.json`. Auch das gesonderte Profil mit verzögerten Favicons und langsamer Mobilverbindung besteht bei CLS 0.

## Upgrade und Rollback

Frontend **und** Backend gemeinsam auf `xtend-search:0.7.5` und `xtend-search-searxng:0.7.5` aktualisieren. Vorher beide Datenvolumes und die geschützte Env-Konfiguration sichern. Compose-/Portainer-Vorlagen enthalten das geprüfte Paar. Keine Datenmigration; Freigaben, SSO und persistierte Schutzfristen bleiben erhalten. Falls Upstream Eigenschaften einer Engine ändert, verlangt die bestehende Katalogprüfung weiterhin eine erneute Freigabe statt eine alte Freigabe stillschweigend zu erweitern. Browser-Tabs anschließend neu laden.

Für Rollback das vorherige Paar **Frontend 0.7.4 / Backend 0.5.1** mit dem gesicherten Datenstand verwenden. Die älteren Images allein mit dem neuen Backend zu mischen ist nicht kompatibel. Das lokale Docker-Paket enthält ladbare Archive, SHA-256, Image-IDs, Quellen und Nachweise. GitHub-Merge, Publishing und Produktionsdeployment sind getrennte Schritte; die bestehende Instanz auf Port 8090 wird bei der Entwicklung nicht ersetzt.
