# XTend.search 0.3.0 – Installation und Betrieb

Stand: 26.09.2026. Ziel: Linux x86-64, Docker Engine mit Compose v2. Die neue Architektur besteht aus zwei Images: `xtend-search:0.3.0` (Node/XTend) und `xtend-search-searxng:0.3.0` (privater Python-Suchkern). Dies ist kein Austausch allein des bisherigen 0.2.1-Containers.

Für Portainer Docker Standalone mit einem Reverse Proxy auf dem Host steht
`compose.portainer.yml` bereit. Sie verwendet die Stack-Umgebungsvariablen und
bereits geladene Images. Siehe [Portainer-Anleitung](PORTAINER-STACK.md).

## Installation aus dem Releasepaket

```sh
tar -xzf XTend-search-Install-0.3.0-linux-amd64.tar.gz
cd XTend-search-Install-0.3.0-linux-amd64
sha256sum -c SHA256SUMS
./prepare.sh
```

`prepare.sh` lädt beide enthaltenen Images und erzeugt eine geschützte `.env.control`, wenn diese noch nicht existiert. Es startet noch keinen öffentlich erreichbaren Dienst. Weder Node noch Python müssen auf dem Server installiert werden. Danach `.env.control` lokal bearbeiten; Secrets nicht in Chat, Tickets oder öffentliche Shell-Protokolle kopieren.

```dotenv
PUBLIC_BASE_URL=https://search.ccs-networks.de
XTEND_PORT=8090
XTEND_BIND_IP=127.0.0.1
SEARXNG_BASE_URL=http://searxng:8082/
# SEARXNG_TOKEN: der bereits generierte gemeinsame Backend-Schlüssel
NEXTCLOUD_BASE_URL=https://vm.ccs-networks.de/cloud/
NEXTCLOUD_CLIENT_ID=CLIENT_ID_AUS_NEXTCLOUD
NEXTCLOUD_CLIENT_SECRET=CLIENT_SECRET_AUS_NEXTCLOUD
NEXTCLOUD_INDEX_PHP=0
XTEND_ADMIN_ROLES='{"EXAKTE_NEXTCLOUD_KENNUNG":"administrator"}'
XTEND_PROBES=0
XTEND_ADMIN_MUTATIONS=1
XTEND_STREAMING=1
XTEND_KNOWLEDGE=1
```

Die hier gezeigten Client-/Benutzerwerte sind Platzhalter. Bei Nextclouds eingebauter OAuth2-Funktion einen Client mit exakt `https://search.ccs-networks.de/admin/oauth/callback` registrieren. Für den lokalen Test gilt stattdessen `PUBLIC_BASE_URL=http://localhost:8090` und `http://localhost:8090/admin/oauth/callback`. Ein Test-Client für localhost ersetzt keinen Produktions-Client. Die exakte Nextcloud-Benutzerkennung kann vom sichtbaren Anzeigenamen abweichen.

```sh
docker compose --env-file .env.control -f compose.control.yml config --quiet
docker compose --env-file .env.control -f compose.control.yml up -d --no-build
docker compose --env-file .env.control -f compose.control.yml ps
curl --fail http://localhost:8090/health/ready
```

Im Installationspaket enthält Compose keine Build-Anweisung. Ein Neubau aus Quellen erfolgt im entpackten `xtend-search-0.3.0-source.tar.gz` mit den beiden Dockerfiles. Bei eingeschränktem Build-Netz kann `docker build --network=host` verwendet werden; zur Laufzeit bleibt die private Compose-Bridge aktiv.

## Netzwerk und Reverse Proxy

`SEARXNG_BASE_URL` ist die explizite Backend-Adresse. Innerhalb desselben Compose-Netzes funktioniert der Service-Name `searxng`; `localhost` würde auf den Node-Container selbst zeigen. Ein anderer SearXNG-Dienst muss im erreichbaren Docker-Netz liegen oder über einen privaten Hostnamen erreichbar sein. Beide Seiten benötigen denselben `SEARXNG_TOKEN`. Der Adapter akzeptiert ausschließlich den geprüften Versions-/Profilvertrag; eine beliebige öffentliche SearXNG-Instanz wird absichtlich nicht automatisch akzeptiert.

SearXNG veröffentlicht keinen Host-Port. Das Netzwerk ist nicht `internal:true`, weil die Provider Internetzugang benötigen. Zwei getrennte persistente Volumes speichern Control Plane/Signierschlüssel und das Backend-Secret. Runtime: Nicht-Root, schreibgeschütztes Dateisystem, begrenztes tmpfs, keine zusätzlichen Linux-Capabilities. `SEARXNG_TOKEN_FILE` und `NEXTCLOUD_CLIENT_SECRET_FILE` werden von den Hosts ebenfalls unterstützt; bei Docker Secrets die entsprechenden Dateien zusätzlich einhängen und die Compose-Umgebung gezielt umstellen.

Für einen Reverse Proxy im Hostnetz genügt `127.0.0.1:8090`. Bei einem Proxy in einem anderen Container ein gemeinsames externes Docker-Netz ergänzen und dort `search:8080` verwenden. Den privaten Suchkern dabei nicht veröffentlichen.

Beispiel für den bereits vorhandenen TLS-vHost:

```nginx
location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 45s;
    access_log off;
    # Der Host komprimiert statische Assets. NDJSON bleibt hier unkomprimiert,
    # sofern der konkrete Proxy keinen nachweislich flushenden gzip-Pfad hat.
    gzip off;
}
```

Der Host verwendet `PUBLIC_BASE_URL` als vertrauenswürdigen Ursprung und vertraut keinem beliebigen Forwarded-Header zur Authentifizierung. Kein URL-/Request-Body-Logging, kein Proxy-Cache für Suche, Medien oder Admin. Falls Zugriffsstatistik nötig ist, nur feste Routennamen und Statusklassen erfassen. Insbesondere Suchquery, OAuth-Code, State, Cursor und Cookie nicht loggen. Die synthetische Abnahme prüft zusätzlich einen komprimierenden Proxy mit `Z_SYNC_FLUSH`; die Produktionskonfiguration muss denselben frühen Batch-Effekt gesondert bestätigen.

## Nextcloud-Anmeldung

Der Server bindet einen einmaligen OAuth-State an einen HttpOnly-Browsercookie, tauscht den Code serverseitig und prüft die Identität über Nextcloud OCS. Nur explizit hinterlegte Kennungen erhalten eine Rolle. OAuth-Tokens werden weder an den Browser weitergegeben noch gespeichert. Nextclouds eingebaute OAuth2-Funktion ist kein OIDC-Provider; es gibt keine erfundene ID-Token-, PKCE- oder FIDO2-Assurance-Prüfung. Die Anmeldung selbst einschließlich FIDO2 erfolgt bei Nextcloud.

Rollen: Viewer liest; Operator darf Drain, budgetierte Probe und Routingmodus; Administrator darf zusätzlich dauerhafte Quellenpolicies ändern. Alle Änderungen benötigen Session, passenden Origin, CSRF-Schutz, aktuelle Revision und einen begrenzten Grundcode. Bei Neustart sind Sessions bewusst ungültig; erneutes Anmelden ist normal.

**Bekannte Provider-Kante beim echten lokalen Test:** Nextcloud 34.0.3 leitete innerhalb des eigenen Login-Flows zeitweise auf `/cloud/cloud/login/flow/grant` statt `/cloud/login/flow/grant`. Nach Öffnen der korrigierten Provider-URL in derselben Browser-Session und ausdrücklichem Klick des Benutzers auf „Zugriff gewähren“ funktionierte der Callback und die Admin-Shell. Der Client umgeht weder State noch TLS oder Rollenprüfung. Vor einem Produktions-Cutover einen frischen, abgemeldeten Login im Produktionsursprung testen; Nextcloud-/Proxy-Basispfad bei erneutem Doppelpräfix prüfen. Ursache nicht abschließend einer bestimmten Einstellung zugeordnet.

## Quellen freigeben und testen

Neue Katalogeinträge bleiben gesperrt. `/admin` zeigt echte Capabilities, lokale Freigabe, Health/Freshness, Sperrfristen, Budgets, Gründe für ausgelassene Quellen, Ereignisse, aggregierte Historie und Audit.

1. Quelle auswählen, unterstützte Capability-Namen bestätigen und „allowed“ setzen.
2. Zulässige RPM, Parallelität und gemeinsame Fehler-/Quota-Domäne festlegen. Geprüfte Anbietergruppen verwenden; unklare Provider erst nach Klärung freigeben. Unabhängige Anbieter nicht pauschal unter `shared` bündeln, da eine Sperre alle Gruppenmitglieder trifft. Wikipedia/Wikidata/Wikicommons gehören zu `wikimedia`.
3. Sprache, Safe Search, Zeitfilter und Ergebnisart mit einem ausdrücklich freigegebenen Test prüfen. `pagingVerified` erst nach Prüfung der zweiten Seite bestätigen.
4. Policy mit Grundcode speichern. Die UI bestätigt erst nach gemeinsamer Speicherung von Änderung und Audit.
5. Weitere Suchmodi erscheinen als Tabs, sobald entsprechende Quellen freigegeben sind. Web/Bilder bleiben sichtbar. Unterstützte Modes: general, images, news, videos, music, it, science, files, social media. Im MVP sind zusätzliche Modes Link-/Text-Ergebnislisten, keine spezialisierten Video-/Musikplayer oder Karten.

Die globale harte Grenze beträgt 60 Dispatches/Minute und 8 gleichzeitig; zusätzlich 60/8 für gemeinsamen Egress, 30/4 je Fehlerdomäne und das Quellenbudget. Pro Suchlauf höchstens 3 primäre Quellen, optional 1 Knowledge-Quelle und höchstens 1 Knowledge-Fallback; Gesamtfrist 12 Sekunden. Keine versteckte Vollsuche bei leerem Pool. Harte Filter können den Pool auf null reduzieren. Beispielsweise wird eine Knowledge-Quelle ohne bestätigte Safe-Search-Unterstützung bei aktiver Safe Search nicht heimlich zugelassen.

`XTEND_PROBES=0` ist die Release-Voreinstellung. Aktivierung erlaubt maximal 2 Probes/Minute und eine gleichzeitig, nach denselben Quoten/Fristen. Ein „Probe vormerken“-Klick ist keine sofortige oder garantierte Ausführung; die UI zeigt dies. Inaktive Quellen werden nicht getestet. Technische Quarantäne nach Prüfung mit `recovery_review` lösen; der anschließende Watch benötigt erfolgreiche Probes und verkürzt keine Providerfrist. Passive Health-Werte sind keine zugesicherte Ergebnisqualität.

## Daten, Backups und Restore

Control-Plane-Datenbank: `/var/lib/xtend-search/control/control-plane.sqlite`, WAL, Schema 1. Signierschlüssel liegen im selben persistenten Volume. Einzelbesitzer wird mit einem OS-`flock` im Containerstart erzwungen. Nicht horizontal skalieren, keine zweite Instanz mit separatem Budget-Store als Umgehung einsetzen. WEB_CONCURRENCY/XTEND_REPLICAS über 1 werden abgelehnt. Direkter Node-Start ist ein Entwicklungsweg; unterstützter Betrieb erfolgt über den gelockten Containerstart.

Retention: Ereignisse höchstens 10.000/48 Stunden, Minutenaggregate höchstens 500.000/30 Tage, Audit höchstens 100.000/180 Tage. Telemetrie puffert maximal 256 Einträge, Dashboard maximal 16 Streams, 2 pro Konto. Ein reconnectender Adminstream liefert einen begrenzten vollständigen Snapshot; sein Cursor ist ein Änderungshinweis, kein Exactly-once-Replay über Prozessneustarts. Audit enthält Admin-Kennung und Grund, keine Suchinhalte. Rohqueries, Ergebnisse und Ergebnis-URLs werden nicht dauerhaft abgelegt.

Konsistentes Backup bei kurz gestopptem Frontend; Beispiel bei unverändertem Compose-Projektnamen:

```sh
mkdir -m 700 -p backups
docker compose --env-file .env.control -f compose.control.yml stop search
docker run --rm --entrypoint tar \
  -v xtend-search-control_control-data:/data:ro \
  -v "$PWD/backups:/backup" xtend-search:0.3.0 \
  -czf /backup/control-backup.tar.gz -C /data .
chmod 600 backups/control-backup.tar.gz
docker compose --env-file .env.control -f compose.control.yml start search
```

Backups enthalten Schlüssel und Admin-Audit; geschützt lagern. `.env.control` separat verschlüsselt sichern. Backend-Volume bei Bedarf auf gleiche Weise sichern. Restore ausschließlich bei gestopptem `search`, in ein bewusst gewähltes leeres Zielvolume mit erhaltenen Eigentümern UID/GID 10001. Keine Live-SQLite-Datei ohne WAL kopieren. Auf einen früheren Stand zurückzusetzen kann jüngere Quoten/Sperrfristen verlieren: bis zum Ablauf der längsten bekannten Providerfrist den Suchverkehr gesperrt halten, bevor Quellen erneut aktiviert werden.

## Cutover und Rollback

0.2.1 samt altem Compose, Settings, Volumes und Image-Digest erhalten. Zuerst 0.3.0 auf anderem lokalen Port starten, SSO im korrekten Ursprung testen, Quellen/Budgets bewusst freigeben, synthetische und freigegebene Qualitäts-Smokes durchführen, Policy-/Audit-Backup erstellen. Erst dann Reverse Proxy umstellen. Der laufende Produktionsserver wurde durch die lokale Implementierung nicht geändert.

Rollback: Proxy zurück auf den erhaltenen 0.2.1-Dienst; 0.3.0-Frontend anhalten. Keine automatischen Down-Migrations. **Alte 0.2.1-Settings kennen die neuen Adminsperren nicht**: alte Allowlist vor Rückschaltung prüfen; ein Rollback darf keine Providerfristen umgehen. Bei Unsicherheit Wartungsansicht statt unbeschränktem Legacy-Retrieval. `XTEND_STREAMING=0` erlaubt innerhalb von 0.3.0 aggregierte SSR-/Page-Antworten bei unveränderten Quoten; `XTEND_KNOWLEDGE=0`, `XTEND_PROBES=0`, `XTEND_ADMIN_MUTATIONS=0` schalten diese Funktionen getrennt ab. „Conservative“ bleibt ein kleiner freigegebener Pool.

## Störungsrunbooks

| Ereignis | Vorgehen |
|---|---|
| SearXNG nicht erreichbar | Netzwerk, Token und Vertrag prüfen. Shell-Liveness bleibt unabhängig; keine pauschale Providerabwertung oder Restart-Schleife. |
| Budgets leer | Reset/aktive Reservierungen in Admin prüfen, Last begrenzen; keine zweite Instanz starten. |
| CAPTCHA / Rate Limit | Längste lokale/Provider-/Backendfrist respektieren. Geschwister derselben Domäne gesperrt lassen; keine Proxy-/Identitätsrotation. |
| Capability geändert / neuer Backendstand | Quelle bleibt gesperrt bis neue Fingerprints und Isolation geprüft sind. Zum letzten geprüften Image zurück. |
| Veraltete Beobachtungen | „unknown/stale“ korrekt lesen. Nur freigegebene, budgetierte Probes; keine Katalog-Vollabfrage an alle Provider. |
| Query-Leak-Alarm | Betroffenen Log-Sink sofort begrenzen/abschalten; Zugriff einschränken und nach Betriebsvorgaben bereinigen. Keine echten Queries im Debuglog. |
| Speicher-/Auditfehler | Keine neue Freigabe bestätigen, keine neuen Dispatches. Freien Speicher, Volume und Backup prüfen. Datenbank nicht automatisch löschen. |
| Telemetrieausfall | Drop-Zähler/Verbindungsstatus beachten; Admin-Dashboard nicht als vollständiges Ereignisarchiv interpretieren. |
| Falsche Knowledge-Zuordnung | Quelle quarantänisieren oder Knowledge abschalten, mit synthetischer Reproduktion prüfen; keine Felder aus verschiedenen Entitäten vermischen. |
| Fehlgeschlagenes Upgrade | Letzten geprüften Digest/Backup kontrolliert wiederherstellen. Kein stilles HTML-Scraping als Ersatzadapter. |

## Lizenz und Quellcode

Powered by SearXNG steht unter `/info/de/about`. Eigenes XTend.search-Branding bleibt bestehen. `LICENSE` enthält SearXNGs AGPL-3.0; die entsprechenden veränderten Quellen einschließlich Build-Dateien und des vendorten XTend-Pakets werden unter `/source.tar.gz` und als Datei im Installer bereitgestellt. Drittanbieter-Lizenztexte im Paket bleiben erhalten. Knowledge-/Medienrechte gehen dadurch nicht auf XTend.search über; Originalquellen werden verlinkt. Anbieterabhängige Attribution und Nutzungsfreigabe sind bei Quellenfreigabe zu prüfen.
