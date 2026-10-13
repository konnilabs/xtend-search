# XTend.search 0.6.0

Frontend `xtend-search:0.6.0`; unverändertes Backend `xtend-search-searxng:0.5.0`.
Die Entwicklung baut auf dem geprüften 0.5.1-Commit `cf2a90061447cf004e0ce06a5248f672903d6842` aus PR #14 auf. PR #14 muss vor dem Merge dieses Updates in `main` aufgelöst sein. Das SDK und der geprüfte SearXNG-Pin bleiben unverändert. Produktionsdeployment und Merge sind getrennte Schritte.

## Bedienung

Die Suchleiste zeigt ausschließlich die Aktionslupe beziehungsweise den XSpinner. Die Filter verwenden RMT-Surfaces und AnimationEngine mit ersetzbaren Übergängen; ohne JavaScript bleiben die nativen `details` nutzbar. Rahmen, Einrückung und Radien teilen CSS-Tokens. Auf mobilen Displays bleiben die Modi in einer horizontal scrollbaren Zeile, mit automatisch sichtbarem aktivem Tab und einer getrennten Werkzeugzeile.

„Ergebnis melden“ erscheint bei meldbaren Treffern neben den Filtern. Der nicht modale XSearchReportAssistant erlaubt höchstens fünf Treffer mit einem gemeinsamen Grund. Die Linkzustimmung ist anfangs aus. Abbrechen, Moduswechsel und History fragen bei einem Entwurf nach. Fehlgeschlagene Speicherung erhält den Entwurf; ein Batch wird vollständig oder überhaupt nicht angenommen. Fünf Treffer derselben Quelle zählen als eine Qualitätsstimme; die Annahmegrenze zählt ausgewählte Ergebnisse. Ohne JavaScript führt die Ergebnis-Auswahl zum nativen Batch-Formular.

„Wetter“ löst Ortsnamen und Postleitzahlen auf. Mehrdeutige Orte werden zur Auswahl angeboten; die gewählte ID ist im URL navigierbar. Neue Eingaben verwerfen die ID. Sprache bleibt verfügbar; Zeitraum und SafeSearch sind für Wetter ausgeblendet und werden für die übrigen Modi beibehalten.

Das Wetterlayout zeigt modellbasierte aktuelle Lage, 24 Stunden, sieben Tage, Wind, Böen, Feuchtigkeit, Niederschlag, UV und Sonnenzeiten in der Ortszeitzone. Lokale WMO-SVGs unterscheiden Tag/Nacht. Bewegung ist zurückhaltend und pausiert bei Reduced Motion beziehungsweise unsichtbarem Dokument. Uhrzeit beziehungsweise Wochentag und Wetterbeschreibung haben getrennte Datenfelder. Feste Stundenraster, Tageszeilen und von Anfang an vorhandene Messwertplätze halten längere Namen und nachgeladene Daten ausgerichtet; die Beschreibung bleibt als Symboltext zugänglich. Die teilweise bewölkte Sonne liegt durch eine transparente SVG-Maske hinter der Wolke. Der Abbruchdialog verwendet kontrastreiche Shell-Farben, korrekt platzierte Action-Slots, eine mit dem Titel ausgerichtete 44-Pixel-Schließfläche und einen sanften roten Verwerfen-Button.

## Freigabe und Grenzen

- `XTEND_WEATHER=1` macht den Modus verfügbar. Neue Wetterfreigaben sind **aus**: im Observatory unter „Wetter“ durch einen Administrator aktivieren.
- `XTEND_WEATHER=0` deaktiviert den Rollout. `XTEND_WEATHER_ALERTS=dwd|off` steuert den Warnadapter; zusätzlich kann die Administration ihn deaktivieren.
- Free-API ausschließlich für den bestätigten nichtkommerziellen Betrieb. Geocoding, aktuelle Lage und Prognose zählen konservativ 1, 1 und 2 API-Einheiten. Default: 540/Minute, 4.500/Stunde, 9.000/UTC-Tag und 270.000/UTC-Monat; Werte können im Observatory verringert werden.
- Budgets werden atomar vor dem Abruf reserviert und bleiben nach Neustarts erhalten. Fehlversuche verbrauchen ihre reservierten Einheiten. Es gibt zwei gleichzeitige Open-Meteo-Abrufe, vier Sekunden je Abruf und zwölf Sekunden je Servicelauf, ohne automatisches Wiederholen.
- Ortsauflösung: eine Stunde, fehlender Ort: zehn Minuten, aktuelle Lage: 15 Minuten, Prognose: 30 Minuten im begrenzten gemeinsamen Server-RAM. Laufende gleiche Abrufe teilen sich eine Anfrage. Kein Nutzerbezug und keine Suchsession.
- Der vorhandene Tab-RAM-Cache speichert abgeschlossene Wetteransichten bis fünf Minuten, leere Antworten bis eine Minute. Die Warnfrische begrenzt den Cache zusätzlich. Policy-/Build-/Instanzwechsel oder veränderte Warnstände verhindern Wiederverwendung. Der Suchbutton startet stets einen neuen Servicelauf; gemeinsame Provider-Caches schonen weiter die Quote.
- DWD deckt Deutschland ab. Der CAP-Gemeinde-Status-Snapshot wird bei Bedarf höchstens alle fünf Minuten geladen. Polygone, Ausschlussflächen, Update/Cancel, Ablauf und gepinnte amtliche Warngebiete werden geprüft. Fehlende räumliche Zuordnung, alte Produkte und Ausfall bleiben sichtbar; „keine Warnungen“ wird bei unvollständigen Daten nicht behauptet.
- Keine automatische Ortsbestimmung, Karten, Radar oder weltweiten Warnadapter. Open-Meteo erhält Ortsanfragen beziehungsweise Koordinaten; dessen eigene Protokollierung wird im About-Hinweis erklärt. Unsere Telemetrie und dauerhaften Budgetzähler enthalten keine Ortsbegriffe, Koordinaten oder Provider-URLs.

## Installation / Update

Das äußere Paket heißt `XTend-search-Docker-0.6.0-linux-amd64.tar.gz`. Es enthält beide Docker-Archive, Prüfsummen, Image-IDs, Compose, Env-Beispiel, Herkunft und Tests. Dieses **Paket zunächst entpacken**:

```sh
tar -xzf XTend-search-Docker-0.6.0-linux-amd64.tar.gz
cd XTend-search-Docker-0.6.0-linux-amd64
sha256sum -c SHA256SUMS
sh load.sh
```

Die eigentlichen ladbaren Images heißen exakt:

```sh
docker load -i XTend-search-Docker-Image-0.6.0-linux-amd64.tar.gz
docker load -i XTend-search-SearXNG-Image-0.5.0-linux-amd64.tar.gz
```

Vor dem Update die drei bestehenden Datenvolumes sichern. Mit dem bestehenden Stack-Namen und unveränderten Volume-Namen arbeiten. Nextcloud-, Backend- und Rollenvariablen unverändert übernehmen; `portainer.env.example` enthält keine vorhandenen Secrets. Den Host-Proxy weiterhin auf den konfigurierten lokalen Port leiten. In Portainer `XTEND_SEARCH_IMAGE=xtend-search:0.6.0` und `XTEND_BACKEND_IMAGE=xtend-search-searxng:0.5.0` setzen, Compose aktualisieren und den Container neu erstellen. Wetter bleibt bis zur ausdrücklichen Freigabe ausgeschaltet.

SQLite migriert additiv von Schema 3 nach 4. Bestehende Freigaben, Schutzfristen, SSO-Schlüssel, Belege und MOTD werden übernommen. Batch-Stimmen, separate Belegzuordnung, Wetterpolicy und ausschließlich aggregierte Wetterbudgets kommen hinzu. Belege bleiben sieben Tage, Qualitätsaggregate 30 Tage und Aktionsaudit 180 Tage erhalten.

## Rollback

Stack stoppen. Die vorherigen Frontend-/Backend-Images mit dem **vor dem Upgrade gesicherten Datenstand** wieder einsetzen. Neue Guard-/Schemaformate nicht ungeprüft an eine ältere Version übergeben. Keine Volumes mit `down -v` löschen. Die bisherigen Images bleiben als Rückweg vorhanden. Browser-Tabs neu laden, damit Runtime und Tab-Cache zum wiederhergestellten Build passen.

## Quellen und Nachweise

- [Open-Meteo Forecast](https://open-meteo.com/en/docs), [Geocoding](https://open-meteo.com/en/docs/geocoding-api), [Nutzung und Datenschutz](https://open-meteo.com/en/terms), [Zählweise](https://open-meteo.com/en/pricing).
- [DWD CAP](https://opendata.dwd.de/weather/alerts/cap/), [amtliche Gebietsdateien](https://www.dwd.de/DE/leistungen/opendata/hilfe.html?lsbId=627548), [CAP-Profil und Ausschlussflächen](https://www.dwd.de/DE/leistungen/opendata/help/warnungen/cap_dwd_profile_de_pdf_2_1_14.pdf?__blob=publicationFile&v=3).
- Wetterdaten: Open-Meteo; Ortsdaten: GeoNames; Warnungen und Gebietsgeometrien: Deutscher Wetterdienst. Geometrien werden ausschließlich serverseitig verwendet; Herkunft und SHA-256 stehen in `xtend/vendor-inputs/dwd/provenance.json`.
- Contracts, Migration und Datenschutz: `WEATHER-AND-BATCH-0.6.md`. Ausgeführte Gates, Bundle-/Performancevergleich, Image- und Archivnachweise: `xtend/evidence/control-plane/0.6.0-*.json` sowie `release-0.6.0-export.json`. Tatsächliche XTend-MCP-Aufrufe: keine; SDK-/CLI-Build und Tests sind gesondert ausgewiesen.
