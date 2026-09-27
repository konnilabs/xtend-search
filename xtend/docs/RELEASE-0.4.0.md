# XTend.search 0.4.0 — Release und Abnahme

Stand: 27. September 2026. Frontend und erweitertes Backend: **0.4.0 / Linux amd64**. Implementiert, als Docker-Archive exportiert und mit `docker load` geprüft. Die lokale Instanz unter http://localhost:8090 läuft mit diesen Images. Das Produktionssystem wurde nicht verändert.

## Funktionsumfang

- Echte Ergebnis-Favicons über den authentifizierten SearXNG-Adapter und dessen DuckDuckGo-Resolver/SQLite-Cache. Nachrangiges Laden sichtbarer Treffer; Buchstaben bleiben bei fehlenden Icons sichtbar. Zwei gleichzeitige Resolverabrufe, zwei Sekunden Timeout, kein Retry-Loop. Geprüfte und neu kodierte PNGs, 64 MiB positiver Cache, 30 Tage positive und eine Stunde negative Haltbarkeit. `XTEND_FAVICON_RESOLVER=off` deaktiviert dies.
- Anonyme Qualitätsmeldungen bei Treffern, Bildvorschau und Knowledge Cards. XDialog, XToast und natives No-JS-Formular. Authentifizierte Ergebnisnachweise ordnen Meldungen ausschließlich echten Engine-/Capability-Beiträgen zu; Replay- und Annahmegrenzen sind aktiv. URL-Belege benötigen ausdrückliche Zustimmung, liegen verschlüsselt im eigenen Volume und verfallen nach sieben Tagen. Keine Suchbegriffe, Titel, Snippets oder Freitexte im Meldungsbestand.
- Gebündelte Prüfvorschläge, Rollenprüfung und revisionsgebundene Entscheidungen. Opt-in-Auto-Cooldown pro Engine/Capability: 20 passende Meldungen aus zehn Browser-Kontexten innerhalb 60 Minuten → 15 Minuten Pause, höchstens einmal in 24 Stunden. Standardmäßig aus. Keine automatische dauerhafte Sperre; technische Schutzfristen und letzte Quellenabdeckung bleiben erhalten. Browser-Kontexte sind kein Nachweis unabhängiger Personen.
- Observatory mit sechs Arbeitsbereichen: Übersicht, Quellen, Meldungen, Regeln, Ereignisse, Audit. XSurfaceManager und XSidePanel, rechts angedockt beziehungsweise mobil im Vollbild. Listenfilter, Seitennavigation, URL/Back/Forward, getrennte Live-Daten und Formulare sowie Speichern/Verwerfen/Abbrechen bei Entwürfen. Keine Formulardaten oder Belege in Surface-Persistenz.
- XTend 0.8.0/Hydrangea, Maraca SSR/Resumability, XScaler-Stream, Nextcloud-OAuth2, Filterpersistenz und drei Webplätze plus eigener Knowledge-Platz bleiben Grundlage.

## Ausgelieferte Images

Frontend:

```text
xtend-search:0.4.0
sha256:32fbd3fd8429d4ec494f7b32c4f2bae6740066d967f2765f942cb276d23034e8
linux/amd64
```

Backend:

```text
xtend-search-searxng:0.4.0
sha256:6395f9e351cbb2061582dc06d419e0420368a3a180521d52515f52383107f372
linux/amd64
```

Zu laden sind **beide** Dateien:

- `XTend-search-Docker-Image-0.4.0-linux-amd64.tar.gz`
- `XTend-search-SearXNG-Image-0.4.0-linux-amd64.tar.gz`

Das kleine Portainer-ZIP enthält Compose, eine unausgefüllte Env-Vorlage, Update-/Rollback-Anleitung, Prüfsummen und Image-IDs. Die Image-Archive werden separat geliefert. Der Quellstand ist zusätzlich als `XTend-search-0.4.0-source.tar.gz` verfügbar und entspricht dem im Image veröffentlichten `/source.tar.gz`. Abschlussberichte und Testnachweise werden separat ausgeliefert; sie verändern den gebauten Quellstand nicht.

## Abnahme

| Bereich | Ergebnis / Nachweis |
|---|---|
| Backend-/Vertragstests | **64 bestanden, 0 fehlgeschlagen**, `0.4-unit.log` |
| Favicon-Isolation | Absichtlich vier Sekunden langsame Antworten blockieren weder ersten Batch noch Abschluss; feste Iconfläche, Abbruch veralteter Navigation, Timeout-/Negativfallback getestet. `0.4-stream-performance.json`, `0.4-browser.json` |
| Meldungen und Datenschutz | Fälschung, Mehrfachquellen, Replay, Limits, fehlende Belegzustimmung, verschlüsselte Belege und Sieben-Tage-Ablauf getestet. Keine URL im normalen Control-State/Audit. |
| Regeln und Aktionen | Opt-in, Schwellen, Fenster, Neustart, 24-Stunden-Grenze, konkurrierende Revisionen, atomarer Audit, Capability-Abgrenzung und verbleibende Quellenabdeckung reproduzierbar getestet. |
| Observatory | Tatsächliches Docker-Image ohne Source-Bind-Mount: XSurfaceManager/XSidePanel, sechs Bereiche, URL-History, Live-Updates während Entwürfen, Speichern/Verwerfen/Abbrechen, Rollen und Breiten 320–3840 px. `0.4-browser.json` |
| Bestehende Such-UX | Streamfehler, Deduplizierung, Paging, defekte Bilder, Sidebar, XLightbox-Carousel, About-XDialog, Favicons, Filtercookies, SafeSearch-Ausnahme und ausgeklappte Knowledge Cards bestanden. `0.4-edge-browser.log`, `0.4-about-browser.log`, `0.4-preferences-browser.log` |
| No-JS | SSR-Suche und lesbares Dashboard, Filter speichern/löschen, natives Meldeformular und Abmelden geprüft. |
| SSO | OAuth-State, Rollen, Identitätsprüfung und sichere Cookies in Tests; Browser-Anmeldung mit lokalem OAuth-Testserver. Portainer-Redirect korrekt. Der unveränderte echte Nextcloud-Login wurde für dieses Release nicht erneut interaktiv autorisiert. |
| Maraca | Standalone und Admin im finalen Image erfolgreich gebaut: `0.4-image-maraca-build.json`. |
| Docker/Portainer | Beide Archive mit Prüfsumme und `docker load` geprüft; Stack gesund, nur Frontend-Loopbackport veröffentlicht; Wiederanlage erhält Schlüssel und Datenbank. `release-0.4.0-load.json`, `release-0.4.0-portainer-smoke.json` |
| Lokales Upgrade | 14 Freigaberegeln, Revision 36 und 22 bestehende Guards unverändert übernommen; Schema additiv auf 2, keine aktivierte Automationsregel. `release-0.4.0-upgrade.json` |
| Echte lokale Suche | 44 Treffer, sieben gerenderte Ergebnisicons, PNG-Antworten und negativer Fallback; keine Seitenfehler, Dokument erhalten. Keine Meldung in den echten Bestand geschrieben. `release-0.4.0-local-search.json` |
| Release-Inhalt | Quellarchiv mit 960 Einträgen geprüft: keine `.env.control`, privaten Schlüssel, Laufzeitdatenbanken oder Belege; lokale Build-Eingaben enthalten. `release-0.4.0-source-validation.json` |

## Performance und Bundlevergleich

Gleicher lokaler Offline-SearXNG-Backendpfad mit drei Quellen (100/700/2500 ms), gleichen Freigaben, getrennten Control-Stores und gleichen gzip-Proxys. Je drei neue Browser-Kontexte, Chromium 145 auf Ryzen 5 3600. Werte sind Mediane und keine Aussage über Produktionsnetzwerke; Favicon-Cache beim Vergleich warm, Resolver-Isolation separat mit vier Sekunden geprüft.

| Messung | 0.3.5 | 0.4.0 | Differenz |
|---|---:|---:|---:|
| Erste Treffer sichtbar | 413 ms | 420 ms | +7 ms |
| Stream abgeschlossen | 2906 ms | 2925 ms | +19 ms |
| Initial geladenes JavaScript, gzip | 472.908 B | 480.405 B | +7.497 B |
| Gemessener Layoutshift (CLS) | 0 | 0 | 0 |

Die öffentliche Suche lädt keine Admin-Module. Summiert man **alle** ausgelieferten Browser-JS-/CSS-Dateien einschließlich Lazy-Modulen, steigt die Suchseite von 502.005 auf 512.134 gzip-Bytes (+10.129 B), das Admin-Bundle von 484.538 auf 600.623 (+116.085 B). Diese Summen sind kein initiales Transfervolumen; sie enthalten die neuen Dialog-/Surface-Funktionen. Die große bestehende RMT-/Maraca-Runtime bleibt Teil der Ausgangsbasis.

Rohdaten: `0.4-performance-comparison.json`, `0.4-bundle-comparison.json`.

## XTend-Nachweise und Grenzen

Verwendet wurden die tatsächlich installierten SDK-Verträge für PageClient, Maraca-Service-Registry, RMT-Scheduler, XSurfaceManager, XSidePanel, XDialog und XToast. Die Host-Dienste sind in RMT deklariert, damit Maraca sie in die Manifeste aufnimmt. `0.4-xtend-contracts.json` dokumentiert Version, Vertragspfade, Prüfsummen und Integrationsentscheidungen.

**Kein XTend-MCP-Endpunkt war in dieser Sitzung aufrufbar.** Die Implementierung und Abnahme erfolgten mit lokalem SDK, Compiler und Tests; ein MCP-Autonomienachweis wird nicht behauptet. Das tatsächliche iOS-Geräteverhalten, Screenreader und ein mehrtägiger Produktions-Dauertest sind nicht Bestandteil dieser lokalen Abnahme. Anonyme Browser-Kontexte begrenzen Missbrauch, beweisen aber keine unabhängigen Personen; Automatik bleibt deshalb bewusst opt-in.

## Betrieb und Rückweg

Siehe `UPDATE.md` im Portainer-Paket beziehungsweise `UPGRADE-0.4.0.md` im Projekt. Bestehende Volumes und Geheimnisse beibehalten; das zusätzliche Belegvolume gemeinsam mit dem Control-Schlüssel sichern und die Belegfrist auch für eigene Backups beachten. Nach dem lokalen Neustart ist eine neue Nextcloud-Anmeldung erforderlich.

Vor einem Rückweg auf 0.3.5 alle Qualitätsregeln deaktivieren und aktive Qualitätspausen auslaufen lassen oder bewusst in kompatible Engine-Drain-Pausen überführen. Anschließend die bisherigen Images verwenden; die additive Datenmigration erhält den Altbestand.
