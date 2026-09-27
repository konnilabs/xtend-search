# XTend.search 0.4.0 – Upgrade und Betrieb

## Lieferumfang

Frontend `xtend-search:0.4.0`, Backend `xtend-search-searxng:0.4.0`, zwei mit `docker load` ladbare Linux-amd64-Archive, SHA-256-Prüfsummen, Image-IDs und `compose.portainer.yml`. Der Backend-Stand bleibt auf SearXNG `2026.9.19+e831fc2a1` fixiert; der neue Adapter verwendet dessen Favicon-Resolver und SQLite-Cache.

## Update eines bestehenden Portainer-Stacks

1. Datenvolumes sichern. Den vorhandenen Stacknamen sowie `XTEND_CONTROL_VOLUME` und `XTEND_BACKEND_VOLUME` beibehalten. Bestehende Nextcloud- und Backend-Schlüssel unverändert übernehmen.
2. Beide Archive auf den Docker-Host laden:

   ```sh
   sha256sum -c XTend-search-Docker-Image-0.4.0-linux-amd64.tar.gz.sha256
   sha256sum -c XTend-search-SearXNG-Image-0.4.0-linux-amd64.tar.gz.sha256
   docker load -i XTend-search-Docker-Image-0.4.0-linux-amd64.tar.gz
   docker load -i XTend-search-SearXNG-Image-0.4.0-linux-amd64.tar.gz
   docker image inspect xtend-search:0.4.0 --format '{{.Id}}'
   docker image inspect xtend-search-searxng:0.4.0 --format '{{.Id}}'
   ```

3. Image-IDs mit den gelieferten Dateien vergleichen. Die neue Compose-Datei in denselben Portainer-Stack übernehmen. `pull_policy: never` verwendet die lokal importierten Images.
4. Neues Volume `XTEND_EVIDENCE_VOLUME` (Standard `xtend-search-control_evidence-data`) zusätzlich anlegen lassen. Es enthält ausschließlich verschlüsselte, freiwillige Prüfbelege. Der Schlüssel bleibt im bestehenden Control-Volume. Beide Volumes für Wiederherstellungen gemeinsam sichern; Belege nach sieben Tagen auch aus eigenen Backups löschen.
5. Stack aktualisieren. `/health/ready` muss `version: 0.4.0` und `retrieval: compatible` melden. Nach dem Frontend-Neustart ist eine neue Nextcloud-Anmeldung erforderlich.
6. Im Observatory bestehende Freigaben kontrollieren. Die Migration ergänzt Tabellen; sie setzt weder Freigaben, Budgets noch technische Schutzfristen zurück. Alle neuen Automationsregeln sind zunächst deaktiviert.

## Konfiguration

| Variable | Standard / Bedeutung |
|---|---|
| `XTEND_FAVICON_RESOLVER` | `duckduckgo`; `off` deaktiviert Ergebnis-Favicons. In beiden Diensten setzen. |
| `XTEND_EVIDENCE_VOLUME` | Eigenes persistentes Belegvolume im Portainer-Stack. |
| `XTEND_EVIDENCE_DIR` | Im Frontend-Image `/var/lib/xtend-evidence`. UID/GID 10001 benötigt Schreibzugriff. |
| `XTEND_PORT` | Hostport, Standard 8090; intern bleibt das Frontend auf 8080. |
| `PUBLIC_BASE_URL` | Externe HTTPS-Adresse; Nextcloud-Redirect ist diese Adresse plus `/admin/oauth/callback`. |
| `SEARXNG_BASE_URL` | Private Backend-Adresse; Compose verwendet `http://searxng:8082/`. |
| `SEARXNG_TOKEN` | Gemeinsames internes Geheimnis beider Dienste. Kein OAuth-Token. |
| `NEXTCLOUD_*`, `XTEND_ADMIN_ROLES` | Bestehende OAuth2- und Rollen-Konfiguration weiterverwenden. |

Der Reverse-Proxy läuft auf dem Host und erreicht `127.0.0.1:${XTEND_PORT}`. Der Backendport wird nicht veröffentlicht. Streaming weiter ohne Proxy-Pufferung betreiben. Der Favicon-Resolver wird ausschließlich vom Backend kontaktiert; Browser sehen nur gleichursprüngliche URLs. Ältere Backends ohne Favicon-Vertrag liefern weiter Suchresultate mit Buchstaben-Platzhaltern.

Die anonyme Annahmegrenze pro Netzwerk verwendet absichtlich die Socket-Adresse, keine beliebig vertrauenswürdigen Forwarded-Header. Hinter einem gemeinsamen Reverse-Proxy kann sie mehrere Benutzer zusammen begrenzen (60/min; zusätzlich global 120/min). Browser-Kontexte bleiben kein Identitätsnachweis. Keine zusätzliche Tracking- oder IP-Persistenz aktivieren.

## Qualitätsbetrieb

- Meldungen: fünf Meldungen aus mindestens drei Browser-Kontexten in einer Stunde erzeugen einen Prüfvorschlag.
- Viewer lesen Betriebsdaten. Operatoren prüfen Vorschläge, sehen freiwillige Belege und setzen oder beenden temporäre Qualitätspausen. Administratoren ändern Freigaben, Regeln und dauerhafte Sperren.
- Regeln: pro Engine und Capability ausdrücklich aktivieren. Standard: 20 passende Meldungen aus zehn Kontexten in 60 Minuten, 15 Minuten Pause, höchstens einmal in 24 Stunden.
- Automatisch auswertbar: Spam, gefährliche Inhalte, falscher Ergebnistyp. Beschwerden bleiben getrennt von technischen Fehlermessungen.
- Nach jedem Neustart sammelt die Automatik eine volle Stunde neu. Bereits gespeicherte Pausen und ihre Wiederholungssperre bleiben erhalten.
- Eine Qualitätspause kann nur ihre eigene Sperrfrist aufheben. Provider-, Familien-, Backend- und technische Schutzfristen bleiben wirksam.
- Belege werden nach sieben Tagen gelöscht, anonyme Meldungszählungen nach 30 Tagen und Aktions-Audit nach 180 Tagen. Öffentliche Ergebnisnachweise gelten 30 Minuten und werden bei Neustarts ungültig.

## Rückweg auf 0.3.5

Zuerst alle aktivierten Qualitätsregeln im Bereich „Regeln“ deaktivieren. Aktive Qualitätspausen auslaufen lassen. Falls unmittelbar zurückgerollt werden muss, die betroffene Engine über die kompatible Drain-Funktion mindestens für die Restdauer pausieren; dies betrifft dann alle Capabilities und ist eine bewusste Operatorentscheidung. Neue Meldungen während des Rollbacks stehen nicht zur Verfügung.

Erst danach Frontend auf `xtend-search:0.3.5` und Backend auf `xtend-search-searxng:0.3.0` zurücksetzen. Control- und Backend-Volume unverändert weiterverwenden. Die neuen SQLite-Tabellen sind additiv und werden von 0.3.5 ignoriert. Das Belegvolume nicht als Quelle oder Export veröffentlichen. Für eine vollständige Rücksicherung nur ein zusammengehöriges Backup aus dem Wartungsfenster verwenden.

## Lokaler Build

```sh
docker build --network=host -f Dockerfile.searxng -t xtend-search-searxng:0.4.0 .
docker build --network=host -f Dockerfile.control -t xtend-search:0.4.0 .
docker compose --env-file .env.control -f compose.control.yml up -d --no-build
```

Die lokalen Zugangsdaten in `.env.control`, private Signierschlüssel, Control-Daten und Belege sind aus Images und Releasequellen ausgeschlossen.
