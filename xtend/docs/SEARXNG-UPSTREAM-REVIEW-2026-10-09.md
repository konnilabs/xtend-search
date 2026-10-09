# SearXNG-Upstream-Prüfung – 9. Oktober 2026

**Status:** Prüfung abgeschlossen; kontrollierte Übernahme empfohlen. Dieser Prüf-PR ergänzt Dependency- und Backend-Gates. Die eigentliche Core-Übernahme folgt in einem eigenen Update-PR.

## Ergebnis

| Stand | Commit / Version |
| --- | --- |
| Eingebundene Basis | [`e831fc2a1cad50c9979b5f6f680376410218188c`](https://github.com/searxng/searxng/commit/e831fc2a1cad50c9979b5f6f680376410218188c), `2026.9.19+e831fc2a1` |
| Geprüfter Kandidat | [`9f042d2f67666f86204d6874488880a23ba81a8f`](https://github.com/searxng/searxng/commit/9f042d2f67666f86204d6874488880a23ba81a8f), `2026.10.9+9f042d2f6` |
| Abstand | 45 Commits, 225 geänderte Dateien gegenüber der Basis |
| Produkt-Ausgangspunkt | `e9ed065f210a3808b7492519b5aaf28090a5fadb`, Frontend 0.4.1 / Backend 0.4.0 |

Git-Fetch und GitHub-API wurden am 09.10.2026 geprüft. Die Releases-Abfrage lieferte keine veröffentlichten Releases. Bewertet wird ein konkreter Rolling-Commit; SearXNG erzeugt seine Versionskennung aus Commitdatum und SHA. Ein später bewegtes `master` ist ein neuer Kandidat.

Die Aufnahme ist sinnvoll: Mehrere Quellen werden repariert, Knowledge-/Video-Ergebnisse verbessert. Im isolierten Versuch blieben die Streaming-Verträge und die Shell funktionsfähig. Core, lokale Erweiterungen, installierte Python-Pakete und Frontend-Attestierung bilden eine gemeinsame Update-Einheit.

## Relevanter Diff

| Änderung | Nutzen und Folge |
| --- | --- |
| [Wikidata: fehlende Beschreibung als leerer String statt Liste (#6824)](https://github.com/searxng/searxng/pull/6824) | Konsistenter Content-Typ für Knowledge-/Listen-Ergebnisse. Keine Garantie einer Card für jeden Begriff. |
| [Typisierte `Video`-Ergebnisse und Engine-Migrationen (#6743)](https://github.com/searxng/searxng/pull/6743) | Snapshot-Deepcopy, Ranking und JSON müssen neue `msgspec`-Typen vertragen; erfolgreich geprüft. |
| [Infoboxen mit Bildern zuerst (#6815)](https://github.com/searxng/searxng/pull/6815) | Neue Sortierung in `ResultContainer.close()`. Finale Streamdaten behalten diese Sortierung; vorläufige Snapshots vor `close()` können eine andere Reihenfolge haben. |
| [Brave API: SafeSearch-Level korrekt (#6799)](https://github.com/searxng/searxng/pull/6799) | Betrifft `braveapi`, nicht automatisch die normale Brave-Scrapingquelle. Administrative SafeSearch-Ausnahmen bleiben separat. |
| [PrivacyWall (#6813)](https://github.com/searxng/searxng/pull/6813), [Dogpile (#6814)](https://github.com/searxng/searxng/pull/6814), [Tusksearch (#6773)](https://github.com/searxng/searxng/pull/6773) | Request-Anpassungen an Bot-Erkennung. Potenziell bessere Verfügbarkeit; Live-Zuverlässigkeit ist durch Offline-Tests nicht bewiesen. |
| [DuckDuckGo-Preload-Timeout](https://github.com/searxng/searxng/commit/4e2c1ea7f) | Verwendet wieder den konfigurierten Timeout statt eines Engine-Overrides. Lokale Suchfristen zusätzlich prüfen. |
| [Bildquellen-Defaults (#6690)](https://github.com/searxng/searxng/pull/6690) | Im tatsächlichen Basis→Kandidat-Diff erhalten `artic`, `devicons`, `flickr`, `lucide` neu `disabled: true`. Die PR-Beschreibung nennt mehr Quellen als dieser konkrete Diff. |
| Neue Engines / Parser | Iconify, inaktive Findborg-/Xprivo-Einträge, Brave-Parser-Refactoring, Vimeo-Überarbeitung. Neue Quellen erhalten keine automatische Freigabe. |
| Runtime-Abhängigkeiten | `msgspec` 0.21.1→0.22.0; `granian` 2.8.3→2.8.4 einschließlich `[pname]`. Dev-/native Theme-Pakete ändern sich ebenfalls; sie werden vom Standalone-Maraca-Build nicht benutzt. |

## Zwei Integrationspfade prüfen

**Historischer gemeinsamer Host:** `searx/webapp.py` erkennt private XTend-Header. `xtend_stream.py` erweitert `ResultContainer`, kopiert Engine-Batches unter Lock und hält höchstens einen Snapshot in der Queue. Der Originalcontainer wird nicht vorzeitig geschlossen; die normale Abschlusslogik bestimmt das finale Ranking. Node überführt die privaten NDJSON-Snapshots in XTend-AppService-/XScaler-Frames. `xtend_integration.py` ergänzt effektive Filter, Paging und Bildproxy-Metadaten.

**Aktueller Standalone-Control-Plane-Host:** `xtend/server/backend.py` schützt `/config`, `/search` und den Favicon-Adapter per internem Token. `SearxAdapter.execute()` startet ausschließlich einen geplanten Engine-Request. `SearchExecutor` führt begrenzte Dispatches parallel aus und publiziert fertig werdende Quellen unmittelbar über den vorhandenen XTend-Servicehost/XScaler. Dieser Pfad benötigt keine zusätzlichen Python-Zwischenframes. Reguläre Webplätze und Knowledge-Platz bleiben getrennt.

Ein normaler JSON-Suchtest allein deckt Parser-Isolation, Container-Kopien, neue Ergebnistypen und Katalog-Attestierung nicht ab.

## Übernahmeversuch und Nachweise

Im isolierten Worktree wurde der geprüfte Upstream-SHA mit `--no-commit --no-ff` integriert. `searx/webapp.py` und die App-/Branding-Anpassungen mergten automatisch. Einziger Git-Konflikt: die im Produkt gelöschte, von Upstream modifizierte `.github/workflows/ai-policy.yml`. Auch die neue Upstream-Sync-Automation würde wieder eingebracht. Diese Dateien wurden im Test nicht ausgeführt; sie gehören nicht in die Produkt-CI.

Temporäre Kandidaten-Anpassungen:

1. Frozen-Core-Kennung in `Dockerfile.searxng` und Frontend-`PINNED` gemeinsam auf `2026.10.9+9f042d2f6` setzen.
2. Installierten `xtend/requirements.lock.txt` für `msgspec` und `granian` angleichen.
3. Separates Backend-Experiment-Image bauen, Maraca neu bauen und Kandidaten-Frontendquellen in einen vorhandenen 0.4.1-Runtime-Host einhängen.

Die Versionsgrenze wurde explizit geprüft: Der bisherige Frontend-Adapter lehnt das neue Backend als `incompatible` ab; der passend gepinnte Kandidaten-Adapter nimmt es an. Diese Prüfung darf nicht entfernt werden, um ein Update zu erzwingen.

Maschinenlesbare Nachweise: [2026-10-09.json](../evidence/upstream-searxng/2026-10-09.json).

| Prüfung | Ergebnis |
| --- | --- |
| Kandidaten-Docker-Backend / Maraca-Build | Erfolgreich; Image-ID im Evidence-JSON |
| Bestehende Node-Vertragstests | 65/65 auf Kandidat |
| Neue Python-Boundary-Tests | 6/6 auf bisherigem Backend und 6/6 auf Kandidat, jeweils `--network none` |
| Früher Snapshot / Abschluss | Snapshot vor langsamer Quelle; finale Ergebnisse/Infoboxen gleich normaler abgeschlossener JSON-Suche |
| Browser-Shell | Dashboard 320–3840 px, Mock-OAuth/Rollen, Entwürfe/Live-Updates, History, Meldungen, Favicons, signiertes Resume und ungültige Signatur/Fallback erfolgreich |
| Bild-/Stream-Kanten | Bildfehler-Platzhalter, weiter nutzbare Vorschau/XLightbox, signierte Pagination, fehlerhafte/unvollständige/doppelte Frames erfolgreich |
| No-JS | SSR-Suche, Admin-Lesbarkeit/Logout und anonymes Meldeformular erfolgreich |

Die Python-Prüfung verwendet echte Parser, Processor-Dispatch, Container, Serializer und private WSGI-Routen; Provider-Antworten sind lokale Stubs. Geprüft werden typed Images und im neuen Core `Video`, Mehrquellen-Zuordnung, Filter/Paging, Kopier-Isolation und Favicon-Cache/Fallback.

Im lokalen Browserversuch erschien der erste Batch nach **455 ms**, der Abschluss nach **2960 ms**, bei 100/700/2500 ms Fixture-Verzögerung und einem absichtlich vier Sekunden langsamen Browser-Favicon-Pfad. Dies belegt inkrementelle Auslieferung, keinen Geschwindigkeitsgewinn gegenüber einer frisch gemessenen Baseline. Home-Wire: 67.332 Bytes, kein HTML-Duplikat, keine Missing-Capability-Diagnose.

Grenzen: kein Produktions-SSO-Test, keine Live-Provider-Zuverlässigkeitsmessung, Kandidaten-Frontend als Source-Mount statt distributables Release. Die alte monolithische Docker-Auslieferung wurde nicht neu gebaut. Diese Punkte sind Release-Abnahme, falls der Legacy-Host weiter ausgeliefert wird.

## Dauerhafte Gates dieses PRs

- `xtend/upstream-searxng.json`: Baseline-SHA, Version und Checksummen von 17 geprüften Core-/Integrationsdateien.
- `node xtend/scripts/check-searxng.mjs`: prüft Adapter-Pin, beide Frozen-Docker-Kennungen, direkte Python-Anforderungen gegen den installierten Lock und Drift der geprüften Boundary. Auch in `npm run test:control` enthalten.
- `sh xtend/tests/control/upstream-gate.sh`: baut unser Backend und führt sechs Offline-Vertragsprüfungen ohne Netzwerk, Hostports oder persistente Volumes aus.
- GitHub CI führt das Backend-Gate zusätzlich zum Maraca-/Node-Job aus, ohne Produktionscredentials.

Checksummen erkennen Drift, nicht Kompatibilität. Bei einem Update neue Checksummen erst nach Vertragsreview samt neuen Nachweisen aufnehmen. Der Gate-PR enthält insgesamt 67 Node-Tests; die Kandidatenmessung oben lief vor den zwei neuen Pin-Gate-Tests.

Lokale Reproduktion: Auf diesem Rechner benötigte der Docker-Build `XTEND_BUILD_NETWORK=host`, da PyPI-Dateiabrufe im Bridge-Netz scheiterten. `XTEND_BUILD_NETWORK=host sh xtend/tests/control/upstream-gate.sh` nutzt diese Option ausschließlich beim Build; die anschließenden Python-Prüfungen laufen immer mit `--network none`. CI verwendet standardmäßig das normale Build-Netz.

## Folgender Update-PR

1. Branch von `main`; geprüften SHA fetchen und vollständige Upstream-Lineage integrieren. Bei geändertem Kandidaten erneut prüfen. Den modify/delete-Konflikt zuerst mit `git rm .github/workflows/ai-policy.yml` auflösen, danach `git restore --source=HEAD --staged --worktree .github` verwenden: Produkt-CI bewahren und wieder eingeführte Upstream-Workflows entfernen.
2. Python-Lock, Adapter-Pin, Frozen-Versionen und Review-Manifest gemeinsam aktualisieren. Neue eindeutige Frontend-/Backend-Release-Tags und Image-IDs vergeben; verteilte 0.4.1-/0.4.0-Tags nicht ersetzen.
3. Alten/neuen Live-Profil-Katalog vergleichen: Quellen, Kategorien, Paging, Sprache, SafeSearch, Timeout, `enabled`. SearXNG-`disabled` ist eine Defaultauswahl, kein Ersatz für Observatory-Policy. Geänderte Fingerprints führen bereits zu `capability_changed`; Freigaben nach Review erneuern. Unveränderte Metadaten beweisen keine unveränderte Engine-Implementierung.
4. Policies, Budgets, technische Schutzfristen und Qualitätspausen erhalten. Keine globale Freigabe oder Löschung von Guards; neue Quellen starten ungeprüft. Drei Webquellen plus Knowledge-Card erneut prüfen.
5. Gates, Maraca und Docker-/Browsertests auf final gebauten Images wiederholen. Begrenzte Live-Probes freigegebener geänderter Quellen und echte Nextcloud-Konfiguration separat im Test-Deployment prüfen.
6. Upgrade mit Kopien persistierter Volumes testen; Verfügbarkeitsdifferenz dokumentieren; Source-Archiv, Prüfsummen und Portainer-Paket bereitstellen; zuerst im Test-Stack einsetzen. Rollback nutzt das bisherige zusammenpassende Image-Paar und erhaltene Volumes.

`XTEND_BACKEND_IMAGE` ist eine Image-Auswahl für unseren erweiterten Backend-Vertrag. Ein beliebiges offizielles SearXNG-Image enthält interne Authentifizierung, Contract-Header und Favicon-Route nicht. Upstream-Updates erfolgen daher durch geprüften Source-Merge und anschließenden Image-Build.

Die konkrete Übernahme und distributablen Images erfolgen in [Release 0.4.2](RELEASE-0.4.2.md). Die obigen Messungen bleiben historische Kandidaten-Nachweise.
