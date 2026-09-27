# XTend.search 0.3.2 — gespeicherte Filter und Wissenskarten

Frontend: `xtend-search:0.3.2`. Der private Suchkern bleibt `xtend-search-searxng:0.3.0`.

## Änderungen und Bedienung

- **Filter → Als Standard speichern** speichert Sprache, Zeitraum und SafeSearch für 180 Tage in diesem Browser. Das funktioniert auch auf der Startseite ohne Suchbegriff. **Gespeicherten Standard löschen** entfernt diese Vorgabe; die gerade geöffnete Suche bleibt unverändert.
- Explizite Filter in einer URL haben jeweils Vorrang, einschließlich `time_range=` (jederzeit) und `safesearch=0`. Nicht angegebene Filter verwenden die gespeicherten Werte. Zurück/Vorwärts und geteilte vollständige Suchlinks behalten ihre Einstellungen. Aufgerufene Suchlinks überschreiben den gespeicherten Standard nicht.
- Die Speicherung verwendet einen validierten, gleichnamigen First-Party-Cookie `xtend_search_filters` mit `HttpOnly`, `SameSite=Lax` und bei HTTPS `Secure`, ohne Domain-Freigabe. Er enthält ausschließlich drei Filterwerte und eine Formatversion, keine Suchbegriffe, Ergebnisse oder Kontodaten. Dies ermöglicht korrekte Initial-SSR sowie Speichern ohne JavaScript. Es gibt keine parallele Local-Storage-Kopie. Browser, Profile und Geräte haben eigene Vorgaben; Installationen mit demselben Hostnamen teilen den Cookie unabhängig vom Port.
- **Observatory → Quellen → Quelle auswählen → SafeSearch-Ausnahme für diese Quelle → Policy verbindlich speichern** erlaubt ausdrücklich, eine Quelle ohne eigene SafeSearch-Unterstützung trotzdem zu verwenden. Dafür ist die Administrator-Rolle erforderlich. Neue und vorhandene Quellen bekommen keine automatische Ausnahme. Quelle, Capabilities und Budget müssen weiterhin freigegeben sein.
- Für Wikipedia/Wikidata die Capability `knowledge` freigeben, Providergruppe `wikimedia` beibehalten und nach eigener Prüfung die Ausnahme aktivieren. Unterstützt eine Quelle SafeSearch nativ, bleibt der vom Nutzer gewählte Wert wirksam. Nur bei fehlender Unterstützung und expliziter Ausnahme wird für diesen einzelnen Dispatch `safesearch=0` gesendet. Die Anfrage-URL und andere Quellen behalten den ursprünglichen Wert.
- Die Suche weist sichtbar auf verwendete Ausnahmen und mögliche ungefilterte Inhalte hin. Ausnahme bedeutet keine Zusicherung, dass der Provider nur unbedenkliche Inhalte liefert. Sprach-/Zeitraumfilter, Paging-Freigaben, Katalogprüfung, Quarantäne, Sperrfristen und gemeinsame Budgets bleiben wirksam. Zeiträume können Wissensquellen daher weiterhin ausschließen; gegebenenfalls „Jederzeit“ auswählen.
- Wissenskarten sind dauerhaft sichtbare Inhaltsbereiche. Sie benötigen kein Aufklappen; mobil stehen sie im Seitenfluss und überdecken keine Suchergebnisse. Es werden weiterhin nur tatsächlich gelieferte, eindeutig zuordenbare Informationen dargestellt.

## Portainer aktualisieren

1. Das neue Image-Archiv auf den Docker-Host übertragen und die mitgelieferte SHA-256-Prüfsumme kontrollieren.
2. Importieren:

   ```bash
   docker load -i XTend-search-Docker-Image-0.3.2-linux-amd64.tar.gz
   ```

3. Im **bestehenden** Portainer-Stack `XTEND_SEARCH_IMAGE=xtend-search:0.3.2` setzen. Die neue Compose-Datei enthält ebenfalls diesen Standardwert. Bestehende Nextcloud-, Token-, Port-, URL- und Volume-Einstellungen unverändert übernehmen. Backend-Image bleibt `xtend-search-searxng:0.3.0`.
4. Stack aktualisieren. Lokal importierte Images nicht erneut aus einer Registry ziehen. Die Compose-Datei setzt `pull_policy: never`.
5. `/health/ready`, Antwortheader `X-XTend-Version` oder Observatory-Fußzeile müssen **0.3.2** anzeigen. Bei Unklarheiten die Image-ID mit `XTend-search-0.3.2-IMAGE-ID.txt` vergleichen.
6. Gewünschte SafeSearch-Ausnahmen ausdrücklich im Observatory konfigurieren. Es findet keine automatische Änderung vorhandener Quellenfreigaben statt.

Das Image enthält keine produktiven Nextcloud-Secrets, Benutzer-Sessions oder Control-Plane-Volumes. Bei einer Neuinstallation wird zusätzlich das Backend-Image 0.3.0 benötigt; das Frontend-Archiv allein enthält es nicht.

## Rollback

Im selben Stack auf `xtend-search:0.3.1` zurückstellen und erneut bereitstellen; Volumes, Tokens und Nextcloud-Konfiguration beibehalten. Es gibt keine inkompatible Datenbankschemaänderung. Der ältere Stand ignoriert die neue SafeSearch-Ausnahme und gespeicherte Filter. Die Ausnahme gegebenenfalls vor einem Rollback deaktivieren, wenn sie bei einem späteren Upgrade nicht wieder aktiv sein soll.

## Technische Entscheidungen und Nachweise

- RMT/Maraca bleibt Eigentümer von Formularen, Zuständen, Navigation und Rendering. Ein kleiner Browser-Host-Adapter speichert Preferences, prüft die Cookie-Rücklesung und meldet das Ergebnis über eine RMT-Action. Der native POST-Fallback benötigt kein JavaScript.
- Der Preference-Endpunkt nimmt ausschließlich Same-Origin-POSTs mit gültigen Enumerationswerten an. Cache-Control ist `private, no-store`. Ein Speicherfehler beeinträchtigt die aktuelle Suche nicht.
- Die Control Plane prüft die Ausnahme bei Auswahl und Reservierung erneut. Die Reservierung hält den effektiven Wert fest; der Executor kopiert ausschließlich den betroffenen Dispatch-Input. Policyänderungen durchlaufen die bestehende Rollen-, CSRF-, Revisions- und Audit-Transaktion. Der Policy-Fingerprint wird nicht manipuliert.
- Frameworkprüfung über XTend MCP 0.8.0: `xtend_knowledge_context` und `xtend_rmt_compile_check` für Such- und Admin-RMT. Protokoll: `xtend/evidence/mcp/interactions.jsonl`. Der erste Compile-Lauf erkannte fehlende Zeilenumbrüche in neuen State-Initialwerten; diese wurden korrigiert und erneut kompiliert.
- Gezielte Unit-/Integrationstests sowie Docker-Browsertests liegen unter `xtend/tests/control/`. Die zusätzliche Wikipedia-Testquelle verwendet ausschließlich den bereits vorhandenen Offline-Fixture-Engine; Browser-Ergebnisse sind kein Live-Provider-Zuverlässigkeitsnachweis.
- Release-Nachweise: `xtend/evidence/control-plane/release-0.3.2-*`.
