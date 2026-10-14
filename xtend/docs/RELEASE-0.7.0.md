# XTend.search 0.7.0 — MVC- und QoL-Release

Dieses Release übernimmt den geprüften GitHub-Main-Stand
`389239284609a422f0f9d1263a5eae88bafa07d3` vom 14. Oktober 2026,
einschließlich der gemergten PRs [#17](https://github.com/konnilabs/xtend-search/pull/17)
und [#18](https://github.com/konnilabs/xtend-search/pull/18).
Die Release-Anpassung versioniert das Frontend als **0.7.0**.
Der private SearXNG-Backendstand **0.5.1** übernimmt die bereits im Main-Lockfile fixierten Python-Updates.
SearXNG, die privaten Adapter, deren Verträge, der geprüfte Upstream-Pin
und das exakt gepinnte XTend-0.9-SDK bleiben unverändert.

## Änderungen

Das bisherige 0.5.0-Image enthält ältere Python-Pins als der aktuelle Main:
MarkupSafe 3.0.3 → 3.0.4, pytz 2026.3.post1 → 2026.5,
setproctitle 1.3.7 → 1.3.8, typer 0.27.2 → 0.27.3 und
Werkzeug 3.1.8 → 3.1.9. Die neue Backend-Version verhindert eine stille
Wiederverwendung des bisherigen Image-Tags für geänderte Laufzeitpakete.

- Suchshell und Observatory verwenden deklarative RMT-Views und lokale Maraca
  App Services. Dialoge, Bildvorschau, Lightbox und Melde-Assistent werden von
  RMT orchestriert; Controller übernehmen Transport und Browserfähigkeiten.
- Nach einem Cache-Restore dürfen verspätete Favicon-/Thumbnail-Projektionen
  keine andere Ergebnisressource überschreiben. Der Ressourcen-Owner wird
  innerhalb der serialisierten Maraca-Action geprüft, unmittelbar vor dem
  Modell-Commit.
- Ein fehlgeschlagener Favicon-Command beendet die Projektion, statt eine
  erneute Command-Schleife auszulösen. Die native Host-Variante baut ihre
  registrierten Browser-Services ebenfalls ausdrücklich mit.
- Die Qualitätsmeldung wartet auf die tatsächliche Modell- und
  XButton-Freigabe. Die zusätzliche kontrollierte Regression hält einen
  Auswahl-Commit zurück und prüft die anschließende Annahme.
- Die bestehenden Wetteransichten, °C/°F-Umschaltung, Prognose-Icons,
  Filterpersistenz, XScaler-Streams, Cache-Wiederverwendung, Knowledge Cards
  und Nextcloud-Anmeldung bleiben Teil des Releases.

Die Architektur- und Fehlernachweise der Main-Änderungen stehen in
[MVC-Audit](MVC-AUDIT-0.6.0.md) und
[Feedback-/Cache-Vertrag](FEEDBACK-AND-CACHE-COMMITS.md).
Neue Release-Prüfungen liegen separat unter
`xtend/evidence/control-plane/0.7.0-*`; ältere Nachweise bleiben historisch.

## Docker-Paket und Installation

Das Paket heißt **`XTend-search-Docker-0.7.0-linux-amd64.tar.gz`**. Es enthält
beide ladbaren Docker-Archive, Prüfsummen, Image-IDs, Portainer-Compose,
Env-Beispiel, SDK-Herkunft, entsprechende Quellen und Release-Nachweise.

```sh
tar -xzf XTend-search-Docker-0.7.0-linux-amd64.tar.gz
cd XTend-search-Docker-0.7.0-linux-amd64
sha256sum -c SHA256SUMS
sh load.sh
```

Die beiden Image-Archive können auch einzeln geladen werden:

```sh
docker load -i XTend-search-Docker-Image-0.7.0-linux-amd64.tar.gz
docker load -i XTend-search-SearXNG-Image-0.5.1-linux-amd64.tar.gz
```

In Portainer die enthaltene `compose.portainer.yml` verwenden und
`XTEND_SEARCH_IMAGE=xtend-search:0.7.0` sowie
`XTEND_BACKEND_IMAGE=xtend-search-searxng:0.5.1` setzen. Bei lokal geladenen
Images keinen erzwungenen Registry-Pull wählen. Stack- und Volume-Namen,
Host-Port, Reverse-Proxy und Nextcloud-/Backend-Variablen beibehalten;
`portainer.env.example` enthält keine vorhandenen Secrets.
Nach dem Laden den Suchcontainer neu erstellen und Browser-Tabs neu laden,
damit Runtime und Tab-Cache zum neuen Build passen.

## Daten und Rollback

Vor dem Upgrade die vorhandenen Control-, Backend- und Belegvolumes sichern.
Gegenüber 0.6.0 verändert dieses Release das Speicherschema nicht.
Freigaben, Budgets, Schutzfristen, Qualitätsregeln, Belege, MOTD und
SSO-Konfiguration werden übernommen. Wetter erfordert weiterhin seine
ausdrückliche Observatory-Freigabe. Keine Produktionsfreigaben werden
durch den Image-Wechsel erteilt.

Für einen Rollback die vorherigen Images und den gesicherten Datenstand
wiederverwenden. Die vorhandenen Volumes nicht mit `down -v` löschen.
Ein Upgrade von älteren Versionen benötigt zusätzlich die in
[0.6.0](RELEASE-0.6.0.md) beschriebenen Migrationsschritte.
Merge, Registry-Publishing und Produktionsdeployment sind separate Schritte.
