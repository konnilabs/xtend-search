# Portainer – historische Erstinstallation 0.3.5

Für die aktuelle Version **0.4.2** das zusammenpassende Frontend-/Backend-Paar und [die aktuelle Update-Anleitung](UPGRADE-0.4.2.md) verwenden. `compose.portainer.yml` und `xtend/config/portainer.env.example` enthalten die aktuellen Defaults. Die folgenden 0.3.5-Angaben sind historische Hinweise.

Diese Stack-Datei ist für **Docker Standalone auf Linux amd64** und deinen
Reverse Proxy auf dem Host vorbereitet. Sie startet die XTend-Shell und den
passenden privaten SearXNG-Suchkern. Der Proxy verwendet `http://127.0.0.1:8090`.
Alle Nextcloud-Werte kommen aus den Umgebungsvariablen des Stacks. Es sind keine
Quellcodedateien oder eingebundenen Konfigurationsdateien auf dem Server nötig.

## 1. Beide Images bereitstellen

Auf dem **Docker-Host der ausgewählten Portainer-Umgebung** müssen diese Images
bereits geladen sein:

```text
xtend-search:0.3.5
xtend-search-searxng:0.3.0
```

Das frühere einzelne 0.2.1-Image genügt für die neue Architektur nicht. Die
Compose-Datei selbst enthält keine Images. Lade beide mit `docker load -i`
aus ihren jeweiligen Image-Archiven; ein Installationspaket mit mehreren Dateien
muss vorher entpackt werden. `pull_policy: never` verwendet ausschließlich lokal
vorhandene Images. Deshalb in Portainer **Re-pull image / Pull latest image**
deaktiviert lassen. [Docker: Pull-Policy](https://docs.docker.com/reference/compose-file/services/#pull_policy)

Die Image-ID steht im mitgelieferten `IMAGE-ID.txt`. Das neue Frontend trägt
eindeutig den Tag `0.3.5`; der unveränderte SearXNG-Backendvertrag bleibt `0.3.0`.
Das frühere 0.3.0-Installationsarchiv enthielt noch nicht die lokalen Korrekturen
für Dashboardbreite, Listenfilter, XToasts und Anbietergruppen. Den alten Tag
nicht als Aktualitätsnachweis verwenden. Nach dem Update meldet
`/health/ready` die Version `0.3.5`, ebenso der HTTP-Header `X-XTend-Version`
und die Fußzeile des Observatory.

## 2. Stack und Variablen in Portainer anlegen

**Stacks → Add stack → Name `xtend-search-control` → Upload**. Die Datei
`XTend-search-0.3.5-Portainer.compose.yml` auswählen; alternativ ihren Inhalt in
den Web-Editor kopieren. Werte unter **Environment variables** eintragen.
Die beigefügte `.env.example` lässt sich nach dem Ausfüllen auch über
**Load variables from .env file** importieren. Sie wird nicht als Datei in den
Container eingebunden. [Portainer: Stack und Variablen](https://docs.portainer.io/user/docker/stacks/add)

| Variable | Wert / Zweck |
|---|---|
| `PUBLIC_BASE_URL` | `https://search.ccs-networks.de` |
| `NEXTCLOUD_BASE_URL` | `https://vm.ccs-networks.de/cloud/` |
| `NEXTCLOUD_CLIENT_ID` | Client-ID des Produktionsclients in Nextcloud |
| `NEXTCLOUD_CLIENT_SECRET` | Secret dieses Clients |
| `XTEND_ADMIN_ROLES` | `{"EXAKTE_NEXTCLOUD_KENNUNG":"administrator"}` |
| `SEARXNG_TOKEN` | Ein gemeinsamer, zufälliger Schlüssel für beide Container |

Die letzten vier Variablen müssen gesetzt werden. Für einen neuen Backend-Schlüssel
beispielsweise `openssl rand -hex 48` auf dem Server verwenden. Bei einem Update
den vorhandenen Schlüssel übernehmen. Rollen werden anhand der echten
Nextcloud-Benutzer-ID vergeben. In Portainers einzelnen Wertefeldern JSON ohne
zusätzliche äußere Anführungszeichen eintragen.

### Meldung: `required variable SEARXNG_TOKEN is missing a value`

Der Stack wird bereits beim Einlesen der Compose-Datei abgelehnt, bevor ein
Image geladen oder ein Container gestartet wird. `SEARXNG_TOKEN` fehlt in den
**Environment variables dieses Portainer-Stacks** oder sein Wert ist leer.

1. Bei einer vorhandenen Installation den bestehenden `SEARXNG_TOKEN` übernehmen.
   Bei einer Neuinstallation im Serverterminal `openssl rand -hex 48` ausführen.
2. In der Stack-Maske unter **Environment variables → Add environment variable**
   den Namen `SEARXNG_TOKEN` und als Wert den vorhandenen Schlüssel beziehungsweise
   die komplette Ausgabe dieses Befehls eintragen. Den Befehl selbst nicht als
   Wert eintragen. Keine zusätzlichen Anführungszeichen im einzelnen Wertefeld.
3. Auch `NEXTCLOUD_CLIENT_ID`, `NEXTCLOUD_CLIENT_SECRET` und `XTEND_ADMIN_ROLES`
   müssen dort vollständig gesetzt sein; anschließend den Stack erneut deployen.

Der Backend-Schlüssel ist unabhängig von Nextcloud. Es genügt **eine** Stack-
Variable: Die Compose-Datei übergibt ihren Wert automatisch an beide Container.
Das bloße Hochladen der YAML oder einer unverändert leeren `.env.example` reicht
nicht aus. Eine Konfigurationsdatei im SSH-Verzeichnis wird von Portainer nicht
automatisch eingelesen; die ausgefüllten Werte explizit in der Stack-Maske setzen
oder über **Load variables from .env file** importieren. Der Pflichtcheck bleibt
erhalten, da beide laufenden Dienste einen nicht leeren gemeinsamen Schlüssel
benötigen. Ein Image-Neubau ist für das Ergänzen der Stack-Variablen nicht nötig.

Optionale Werte:

| Variable | Standard |
|---|---|
| `XTEND_PORT` | `8090`, nur an `127.0.0.1` gebunden |
| `NEXTCLOUD_INDEX_PHP` | `0`; `1` nur bei Nextcloud-Routen mit `index.php/` |
| `XTEND_PROBES` | `0`, aktive Hintergrundprobes deaktiviert |
| `XTEND_ADMIN_MUTATIONS` | `1`, Änderungen im Admin-Bereich erlaubt |
| `XTEND_STREAMING` / `XTEND_KNOWLEDGE` | jeweils `1` |
| `XTEND_SEARCH_IMAGE` / `XTEND_BACKEND_IMAGE` | die oben genannten Image-Tags |
| `XTEND_CONTROL_VOLUME` | `xtend-search-control_control-data` |
| `XTEND_BACKEND_VOLUME` | `xtend-search-control_backend-data` |

In Nextcloud muss beim Produktionsclient exakt diese Weiterleitungsadresse stehen:

```text
https://search.ccs-networks.de/admin/oauth/callback
```

Der lokale Testclient mit Callback `http://localhost:8090/admin/oauth/callback`
passt nicht zu dieser Produktionskonfiguration.

## 3. Starten und Host-Proxy verbinden

**Deploy the stack** wählen und warten, bis beide Container `healthy` sind.
Der Start der Shell wartet auf den bereiten SearXNG-Container. Intern verbindet
sie sich über `http://searxng:8082/`; der Backend-Port wird nicht veröffentlicht.
Das gemeinsame Docker-Netz hat ausgehenden Internetzugriff für Quellen und SSO.

Für deinen vorhandenen HTTPS-vHost muss das Proxy-Ziel auf
`http://127.0.0.1:8090` zeigen. Bei einem anderen `XTEND_PORT` entsprechend
anpassen. Für Streaming Proxy-Pufferung und Cache deaktivieren, mindestens
45 Sekunden Lesezeit zulassen. Beispiel für Nginx **innerhalb des bestehenden
HTTPS-vHosts**:

```nginx
location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 45s;
    access_log off;
    gzip off;
}
```

Auf dem Server prüfen:

```sh
curl --fail http://127.0.0.1:8090/health/ready
```

Danach `https://search.ccs-networks.de/` und `/admin` im Browser öffnen,
Nextcloud-Anmeldung durchführen und Quellen samt Capabilities/Budgets freigeben.
Bei einem neuen Datenvolume sind Quellen absichtlich noch gesperrt. Für jeden
gewünschten Suchmodus eine passende Quelle einschließlich der benötigten
Filterunterstützung auswählen. Anbietergruppen verwenden, beispielsweise `bing`,
`brave` und `duckduckgo`; unabhängige Anbieter nicht pauschal als `shared` gruppieren.

## Updates und bestehende Daten

Die benannten Volumes erhalten Admin-Freigaben, Quoten, Schutzfristen, Audit und
Signierschlüssel. Bei einer vorhandenen 0.3.0-Installation die beiden Volume-Namen
abgleichen und übernehmen. Vor einem Wechsel von einer separat gestarteten
Compose-Installation deren Container stoppen, sodass der Stack dieselben Volumes
allein besitzt. Pro Datenbestand darf genau eine Shell laufen.

Beim Update die Volumes und Variablen beibehalten, das neue Image auf denselben
Docker-Host laden und den Stack neu deployen beziehungsweise den Search-Container
neu erstellen. Ein einfacher Neustart aktualisiert weder das Image noch geänderte
Container-Umgebungsvariablen. Nach Neuerstellung erneut im Admin-Bereich anmelden.
Volumes beim Entfernen/Ersetzen des Stacks nicht löschen. Die alte 0.2.1-Version
hat ein anderes Datenmodell; ihre Volumes nicht als Control-Plane-Daten einsetzen.

## Lokale Prüfung

Die Datei wurde mit den oben genannten Images in einem separaten Compose-Projekt,
eigenen Testvolumes und einem anderen Loopback-Port erfolgreich geprüft: Beide
Container waren gesund, der Backend-Vertrag kompatibel, der Nextcloud-Redirect
korrekt und die Signierschlüssel nach Neuerstellung unverändert. Auch Rollen-JSON,
Sonderzeichen im Test-Secret und die Prüfung leerer Pflichtvariablen bestanden.
Alle Testcontainer und Testvolumes wurden anschließend entfernt.
Die echten Auth-Secrets werden weder kopiert noch in die Download-Dateien eingebettet.
Die Freigabe echter Suchquellen und das Deployment auf dem Produktionsserver sind
nicht Bestandteil dieses Stack-Datei-Tests. Der Prüfbericht liegt dem ZIP bei.
