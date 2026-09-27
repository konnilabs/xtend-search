# ADR-XSEARCH-QUALITY-004 — Ergebnisqualität und produktives Observatory

Status: implementiert; Abnahmen siehe RELEASE-0.4.0.md. Grundlage: freigegebener 0.4-Plan, Ergänzung zu ADR-XSEARCH-CP-001. Version: 0.4.0.

## Entscheidung und Datenfluss

Die Suchausführung bleibt im Control-Plane-Executor. Kein Favicon-Aufruf liegt im Suchpfad: Nach der Normalisierung werden ausschließlich signierte Domain-Adressen und verschlüsselte Ergebnisnachweise ergänzt. Bestehende drei Webplätze und ein separater Knowledge-Platz bleiben erhalten.

Favicons: Browser → signierter `/favicon`-Endpunkt → authentifizierter `/xtend/favicon`-Adapter → SearXNG-DuckDuckGo-Resolver. Native `FaviconCacheSQLite`-Instanzen behalten positive Ergebnisse 30 Tage (64 MiB Ziel), negative Ergebnisse eine Stunde (1 MiB). Zwei Backend-Slots, zwei Sekunden Resolver-Timeout, PNG-Neukodierung mit Pillow nach Format-/Größenprüfung. HTML und SVG werden nicht weitergegeben. Die sekundäre Browserarbeit verwendet den vorhandenen RMT-Scheduler (`background`, `after_paint`), IntersectionObserver und niedrige Fetch-Priorität. Navigation bricht veraltete Abrufe ab. Ohne JS bleiben Buchstaben-Icons.

Anonyme Meldungen gehen über den Maraca-Command `search.feedback.submit` oder denselben serverseitigen Handler des nativen Formulars ein. Der Ergebnisnachweis ist AES-GCM-authentifiziert, enthält echte Dispatch-Quellen und deren Katalog-Fingerprints und ist 30 Minuten gültig. Seine Kennung ist pro Suchlauf/Ergebnis stabil. Replays zählen nicht erneut; frei mitgesendete Engine-Namen sind ohne Wirkung. Identitäts- und Netzwerklimits bleiben im RAM. Das Cookie wird erst beim Öffnen des Meldeformulars gesetzt.

## Begrenzte Ausnahme zum bisherigen Inhaltsverbot

Nur nach aktiver Zustimmung darf die URL genau dieses Ergebnisses als Prüfbeleg gespeichert werden. Keine Suchbegriffe, Titel, Beschreibungen oder Freitextfelder. URLs können ihrerseits Suchparameter enthalten; sie werden daher wie vertrauliche Inhalte behandelt. AES-256-GCM-Verschlüsselung, separater Belegspeicher/Volume, zufällige Referenzen, maximal sieben Tage, Zugriff nur über rollenprüfenden Admin-Service. URLs erscheinen weder im normalen Admin-Snapshot noch in Telemetrie, Aktions-Audit, Quellenarchiv oder Standardexport. Die Ausnahme gilt nicht für automatische URL-Speicherung oder Backendabrufe zur Prüfung des Linkinhalts.

SQLite ergänzt Regeln, Qualitätspausen, anonyme Meldungseinträge und Vorschläge. Keine Browserkennungen oder IP-Adressen werden in diesen Tabellen gespeichert. Freiwillige Belege werden nur über zufällige Referenzen zugeordnet. 30 Tage Meldungen, 180 Tage Audit. Atomare Transaktionen binden Regeländerung/Aktion und Audit an dieselbe Revision; Idempotenzschlüssel verhindern doppelte Aktionen.

## Kontrollierte Automatik

Default aus. Schwellen und Rollen entsprechen dem genehmigten Plan. Nur die jeweilige Engine/Capability wird pausiert. Technische Schutzfristen werden nicht verkürzt. Die zuletzt verfügbare Suchquelle bleibt erhalten; Knowledge-Engines ersetzen dabei keinen Web-Slot. Anonyme Kontexte beweisen keine unabhängigen Personen, weshalb permanente Sperren ausschließlich manuell bleiben.

Neustart: neues RAM-Beobachtungsfenster und neue Ergebnis-/Browsernachweise. Persistente Qualitätspausen und `lastAutoAt` bleiben wirksam. Regeländerungen verwerfen das laufende Auswertungsfenster des Scopes. Eine unverbindliche Vorprüfung in der UI zeigt nur die aktuelle Schwellenlage; sie führt keine Aktion aus.

## Observatory und XTend-Verträge

Sechs URL-navigierbare Arbeitsbereiche: Übersicht, Quellen, Meldungen, Regeln, Ereignisse, Audit. RMT liefert SSR und Resume Seeds; PageClient führt Besuche und History aus. XSurfaceManager besitzt das Detailpanel; XSidePanel liegt rechts angedockt und wird auf kleinen Displays im Vollbild angezeigt. Keine freie Verschiebung. Formulardaten und freiwillige Belege werden nicht in Surface-Snapshots persistiert; Persistenzmodus `none`. Routen stehen in der URL, Entwürfe nur im Arbeitsspeicher.

Live-Updates verändern `admin.live`, Formulare lesen `admin.data`. Quellenwechsel mit Entwürfen bieten Speichern/Verwerfen/Abbrechen. XToast bestätigt erfolgreiche Serviceaktionen erst nach serverseitigem Erfolg. Keine zusätzliche React-/Vue-Schicht. Das lesbare SSR-Dashboard und native Meldungen bleiben ohne JavaScript erreichbar.

Verwendete lokale SDK-Verträge (0.8.0/Hydrangea):
- `xtendrmt/page-client.d.ts`: `visit`, `reload`, `optimistic`, `subscribe`.
- `xtend-maraca/app-services.d.ts`: Registry `invoke`/Promise und NDJSON-Streams.
- `components/xsurfacemanager.d.ts`: `openSurface`, `dockSurface`, `readSnapshot`.
- `components/xsidepanel.d.ts`: `setPanelMode`, `resizePanel`.
- RMT-Scheduler: `schedule` mit Lane `background` und Strategie `after_paint`.
- XDialog und XToast aus den lokalen Komponentenmodulen.

Im verfügbaren Toolkatalog war kein XTend-MCP-Endpunkt aufrufbar. Daher wurden SDK-Deklarationen, lokale Dokumentation und Quellcode verwendet; keine MCP-Interaktionen werden behauptet. Ein zusätzlicher MCP-Autonomietest ist damit kein nachgewiesenes Ergebnis dieses Releases. Maraca-Komponentendeklarationen müssen die per Host verwendeten Dienste referenzieren, damit die generierten Manifeste sie zulassen. Diese konkrete Integrationskorrektur ist in Build- und Browsertests belegt.

## Referenzen

- [SearXNG Favicon-Infrastruktur und Cache](https://docs.searxng.org/admin/searx.favicons.html)
- Gepinnte lokale Implementierung: `searx/favicons/cache.py`, `searx/favicons/resolvers.py`.
- [Pillow-Paket](https://pypi.org/project/Pillow/12.3.0/), verwendet ausschließlich für geprüfte Rasterdekodierung und PNG-Neukodierung.
- Betriebs- und Rollbackanleitung: UPGRADE-0.4.0.md.
