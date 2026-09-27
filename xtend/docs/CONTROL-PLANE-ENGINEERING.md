# CP-001 – Implementierungs- und XTend-Evidenz, Version 0.3.0

## Stand und Architektur

SearXNG-Quellstand `e831fc2a1cad50c9979b5f6f680376410218188c`; privates Backendprofil `engine-json-v1`. XTend bleibt beim bereits vorhandenen Hydrangea-Paket `@ccslabs/xtend 0.8.0`. Der aktuelle lokale Framework-Checkout wird als Wissens-/MCP-Werkzeug verwendet, nicht stillschweigend als neues Runtime-Paket übernommen. Kein React/Vue, keine Änderung des lokalen Framework-Kerns.

`standalone.mjs` setzt echte `createNodePageHost`- und `createNodeAppServiceHost`-Instanzen zusammen. RMT deklariert öffentliche Suche und getrennte private Admin-UI. Maraca baut Browser-/Servergraphs, Manifeste und den kompilierten Service-Einstieg. `server-services.ts` ist die dünne Bindung; Adapter, Planung, Reservierungen, Ausführung, Knowledge, Storage und Auth liegen in Domänenmodulen unter `server/control`.

Der neue Pfad verwendet den kanonischen Maraca-AppService-Transport für JSON/NDJSON. XScaler bleibt im bisherigen 0.2.1-Deployment verfügbar; für gewöhnliche Daten wird in diesem ADR bewusst kein zweiter Frame-Codec eingebaut. Pro Engine ein authentisierter, begrenzter SearXNG-JSON-Aufruf, danach sofortiger echter Batch. Innerhalb einer Engine bleibt SearXNG aggregierend. Der Python-Host attestiert Version/Profil, authentisiert und unterbindet Inhaltslogging; keine neuen Providerparser in Node.

Initialaufruf bleibt vollständiges SSR mit signiertem Resume Seed. Nach Navigation liefert PageClient eine leere, reservierte Result-Surface; der öffentliche SDK-Service-Iterator liefert begrenzte Batches. Ein Präsentationskoordinator wartet pro Commit auf einen Animation Frame, hält höchstens einen Commit bereit und verwendet PageClient.optimistic. Abbruch, neue Invocation und URL-State verhindern alte Commits. Keine künstliche Aufteilung einer bereits vollständig abgeholten Gesamtsuche.

## Nachvollziehbare Framework-Entscheidungen

- `xtend/scripts/mcp.mjs` startet den echten lokalen XTend-MCP über stdio, mit Produktworkspace als Root. `evidence/mcp/interactions.jsonl` protokolliert Tool, Inputhash, Zeit, Status und Ergebnisdatei. Die Artefakte sind nicht durch erfundene MCP-Antworten ersetzt.
- Knowledge-/Compile-Hilfe wurde abgefragt; final sind `frontend/standalone.rmt` und `admin/admin.rmt` mit `xtend_rmt_compile_check` geprüft. Der eigentliche Build läuft über `buildMaracaBundleAsync` und `buildPages` mit derselben vendorten Runtime. Evidence enthält Quellhashes.
- Strikte Orchestration, Kernel, Hydration und getrennte Servicegraphen bleiben aktiv. Der bestehende Framework-Grundbedarf überschreitet das frühere Bundleziel; deshalb steht ausschließlich das allgemeine Size-Budget auf `warn`. Servicegraph-Budgets bleiben strikt. Das ist ein offener Performancepunkt, kein behaupteter Budgeterfolg.
- Die erste RMT-Mutationsvariante kompilierte, projizierte aber die Antwort nicht richtig. Der Browsertest zeigte es. Korrekte effektive Reduktion: `reduce state.admin.data = result`; Serviceantwort ist ein flaches View-Modell. Nicht unterstützte Syntax `result admin.data` und ein `closest`-Directive wurden verworfen.
- Wiederholte Quellenbuttons trafen im getesteten Eventrouting nicht zuverlässig jede Zeile. Die Quelle wird nun über normale, resumierbare `/admin?engine=...`-Links gewählt. Kein privater Runtimepatch und kein eigener Router.
- Für native Abmeldung sendete Chromium unter `no-referrer` einen `Origin:null`. Die Admin-Seite verwendet nun `same-origin` für Header und Meta-Policy; externe Referrer bleiben unterdrückt, die strikte Origin-/CSRF-Prüfung bleibt bestehen. Der No-JS-Browsertest prüft auch die echte Abmeldung.
- CSRF muss über den PageHost-Kontext `csrfToken` in den kanonischen PageClient gelangen. Bootstrap-Headers allein wurden überschrieben und waren kein verlässlicher Schutz. HTTP- und Browserprüfungen sichern den endgültigen Weg.
- AppService-Domainfehler behalten den SDK-Envelope. Der Host ordnet die Statuscodes für Validation, CSRF, Rolle und Revisionskonflikt dem HTTP-Status zu; keine alternative API mit anderem Fehlervertrag.
- XLightbox/XAlert, Preview-Steuerung und Placeholder aus dem Produkt bleiben erhalten. Die bestehende dokumentierte Build-Anpassung ergänzt nur den benannten XLightbox-Controls-Slot im ausgelieferten Komponentenbuild. Der neue Medienpfad `/media` ist in den App-Integrationen freigegeben; externe Fremd-URLs werden nicht direkt als Proxyparameter vertraut.
- Ein zusätzliches `noscript`-/`style`-Fragment bestand den RMT-Compilecheck, scheiterte aber im echten SSR-Renderpfad. Der Docker-No-JS-Test deckte dies auf; das Fragment wurde entfernt. Die Admin-Übersicht nutzt nun normale deklarative Elemente und erklärt ihre JavaScript-Anforderung. Native Formfallbacks benutzen POST, sodass kein CSRF-Wert in einem Querystring landet. Compiler-Erfolg wird deshalb ausdrücklich nicht mit Browser-/SSR-Funktion gleichgesetzt.
- Ein Paging-Regressionsfall zeigte doppelte `previous`-Keys aus dem Legacy-Normalizer. Der Standalone-Executor erstellt jetzt sämtliche signierten Seitennavigationslinks selbst; Domänen- und Browsertest decken Seite 2 ab.

## Vertrag, Grenzen und bewusste Abweichungen

- Unbekannte Engines, geänderte Capabilities oder ein unbekannter Backendvertrag führen nicht zu breiterer Suche. Kategorien/Cookies/Plugins/Engine-Daten werden nicht an Einzel-Engine-Aufrufe durchgereicht; spezielle SearXNG-Operatoren werden vor Dispatch abgelehnt. `site:` bleibt erlaubt.
- Quoten und Sperren werden vor Ausführung atomar in SQLite reserviert. Nach Abbruch bleibt tatsächlicher externer Aufwand gezählt; zeitlich begrenzte Lease-Daten verhindern sofortige Überbuchung nach Neustart. Der Prozess verwendet eine Serialisierung für Policy/Reservierungen/Health. SQLite läuft in einem Worker mit begrenzter Queue und Deadline.
- Providerinterne Restdauer kann der Adapter nicht exakt beobachten; Abbruch beweist keine beendete Providerarbeit. Health zeigt Adapter-Roundtrip und explizit unbekannte native Backend-Endzeit. Konservative Obergrenzen dürfen nie als genauer Providerheader ausgegeben werden.
- Knowledge akzeptiert eine eindeutig gelieferte, attribuierte Entität; Mehrdeutigkeit bleibt sichtbar. Ein Fallback nach Rate-/Netzfehler darf nicht dieselbe Quota-Domäne wiederverwenden. Sichere Filter werden auch für Knowledge nicht abgesenkt. Keine unabhängige Entity-Resolution über mehrere Provider.
- Pagination hält einen kurzlebig signierten Plan fest, bindet Query/Filter und prüft aktuelle Policy erneut. Sie verspricht keine globale Rangliste über mehrere Seiten.
- Admin-Liveansicht überträgt begrenzte Snapshots mit Änderungs-Cursor. Persistente Audit-/Ereignislisten sind begrenzt; kein Exactly-once-Event-Replay, kein vollständiges Analytics-Warehouse.
- Neue Modi liefern im MVP dieselbe zugängliche Link-/Textdarstellung; spezialisierte Media-Player sind Follow-up. Quellen müssen weiterhin pro Capability/Filter/Qualität freigegeben werden.

## Reproduzieren der Prüfungen

```sh
cd xtend
npm ci --ignore-scripts
npm run test:control
npm test
npm run build:control
node scripts/mcp.mjs call xtend_rmt_compile_check '{"path":"admin/admin.rmt"}'
node scripts/mcp.mjs call xtend_rmt_compile_check '{"path":"frontend/standalone.rmt"}'
```

Die MCP-Prüfung benötigt den lokalen Checkout oder `XTEND_ROOT`; Containerbuild und Laufzeit benötigen ihn nicht. Browserprüfung mit `playwright 1.58.2`, Chromium und Node 24.19.0. Isolierte Docker-Fixtures mit `xtend/tests/control/docker-fixture.sh` vom Repo-Root starten (Testports 8092/8093/8094/8096). `proxy-fixture.mjs` lokal starten; `browser.mjs` gibt ausschließlich die sechs lokalen Offline-Engines über die tatsächliche Admin-UI frei. Danach `edge-browser.mjs`. Niemals Fixture-/Lasttests gegen freigegebene Live-Provider richten.

Rohbelege liegen unter `xtend/evidence/control-plane`, einschließlich Unit-, Browser-, Paint-, Docker-, Isolations- und Nextcloud-Belegen. Der Releasebericht benennt die abschließend bestandenen Prüfungen und nicht gemessenen Ziele gesondert. Frühe fehlgeschlagene Debugläufe sind keine Freigaben.

## Admin-UX: Quellen finden und ohne Scrollsprung bearbeiten (26.09.2026)

Der Engine-Pool bietet eine native, aufklappbare Capability-Hilfe mit Freigabeablauf,
Beispiel und Kategoriekennungen. Die Hinweise unterscheiden Katalogunterstützung,
ausgewählte Freigaben, Filterabdeckung, Budgets und Paging-Verifikation. Verfügbare
Kennungen werden zusätzlich direkt am Freigabefeld der ausgewählten Quelle gezeigt.

Kategorie und Namensfilter liegen in der URL (`category`, `filterQuery`). Beide
Filter werden gemeinsam angewandt; Quellenauswahl, Refresh und Mutationsantworten
behalten sie bei. UI-Filter werden vor dem Policy-Write entfernt. Bei keinem Treffer
wird keine fremde Policy angezeigt. Ein Reset-Link stellt den Gesamtkatalog wieder
her. Deutsche Kategorienamen und Trefferzahlen erleichtern die Orientierung. Die
native GET-Form sowie Hilfe und Quellenlinks bleiben ohne JavaScript verwendbar.
Mit JavaScript löst eine Kategorienänderung direkt die vorhandene GET-Form aus;
XTends PageClient bleibt Eigentümer von Navigation, Transport und History.

Quellenlinks und Filterform nutzen die in XTend 0.8.0 vorhandenen Attribute
`data-xtend-preserve-scroll="true"`; die Liste deklariert
`data-xtend-scroll="engine-list"` für History-Restoration. Kein eigener Router,
Scroll-Timer oder Framework-Patch. `flex: 0 0 auto` verhindert die Kompression
von Listenkarten; lange Namen und mehrere Kategorien dürfen umbrechen.

Der Kategorienfilter setzt neben SSR-Attributen die deklarative DOM-Property
`selected` der Optionen: HTML-Attribute allein stellen eine zuvor geänderte
Browserauswahl bei Back/Forward nicht wieder her. Das Namensfeld hat den kanonischen
Filterwert als RMT-Key, sodass geänderte URLs den richtigen Wert wiederherstellen,
während Live-Telemetrie keinen neuen Input-Knoten erzeugt.

Nachweise: MCP-Journal unter `evidence/mcp`; gezielter Browserlauf
`tests/control/admin-ux-browser.mjs` mit 30 rein lokalen Quellen, darunter lange
Namen und Mehrfachkategorien. Er prüft Textgrenzen, Quellenwechsel ohne Reload,
Dokument-/Listenscroll, kombinierte Filter, Speicherung, Refresh, leere Treffer,
Back/Forward, Tastaturhilfe, 320/390/720px sowie Hilfe/Filter/Logout ohne JavaScript.
Die neuen Layout-Fixtures bleiben gesperrt; der bestehende Gesamt-Browserlauf gibt
weiterhin ausschließlich die ursprünglichen sechs Offline-Suchquellen frei.

Die visuelle Kontrolle fand außerdem doppelte Außenabstände des XSection-Hosts.
Die Admin-CSS setzt dessen öffentliche Spacing-Tokens auf null; die eigene Shell
liefert die Abstände. Mobile Filter/Hilfe erhalten damit die nutzbare Bildschirmbreite.

## Volle Desktopbreite und XToast-Rückmeldungen (26.09.2026)

Die 1.400-px-Begrenzung der Admin-Hauptansicht wurde entfernt. Zusätzlich wächst
XSections öffentliches `content`-Part mit `flex: 1 1 0%` über seine intrinsische
Textbreite hinaus. Shell und Hauptansicht verwenden 100% der verfügbaren Breite,
mit den bestehenden Innenabständen; kein `100vw`, das Scrollbalken überdecken würde.

Bestätigte Policy-, Drain-, Probe- und Routing-Aktionen liefern eine transiente
Notification mit eigener ID. Das RMT rendert echte lokale `x-toast`-Komponenten
über den Maraca-Komponentenpfad. Freigabe und Sperrung werden konkret benannt;
Erfolg wird erst nach erfolgreicher Mutation samt Audit gemeldet. Fehlermeldungen
folgen dem vorhandenen RMT-Requeststatus und suggerieren keinen bestätigten Erfolg.
Die Komponenten sind unten rechts fixiert, verschieben keine Formulare, achten
auf Reduced Motion und kündigen Status bzw. Fehler über ihre nativen Live-Regionen
an. Doppelte Live-Regionen in den bisherigen Textmeldungen wurden entfernt.

Erfolgstoasts schließen nach sechs Sekunden; Fehler bleiben bis zum Schließen.
Das öffentliche `toast-dismissed`-Event entfernt die Rückmeldung über einen
RMT-Command aus dem Model, damit Live-Updates sie nicht erneut anzeigen. Bei
manuellem Schließen kehrt der Tastaturfokus zum auslösenden Formularbutton zurück.
Navigation räumt transiente Rückmeldungen auf. Die Microinteractions ändern weder
Freigaberegeln noch Rollen, Budgets oder Authentifizierung.

Browsernachweis: `tests/control/admin-feedback-browser.mjs`, mit Viewports von
320 bis 3840 px und rein lokalen Fixture-Quellen. Er prüft bestätigte Freigabe und
Sperrung, wiederholte Meldungen, Ablauf/Schließen, Fokus, einen abgelehnten
Capability-Write, mobile Positionierung und reduzierte Bewegung.

Für die Fokusrückgabe wird die Formular-ID per `getAttribute('id')` gelesen:
Das vorhandene versteckte Formularfeld `name="id"` überschattet den nativen
`form.id`-Accessor. Der aktuelle Submit-Button wird nach dem RMT-Commit erneut
aufgelöst, statt eine möglicherweise ersetzte DOM-Referenz zu verwenden.

## Anbietergruppen und Suchausfall am 26.09.2026

Die lokale Revision 14 hatte alle freigegebenen Quellen in der bisherigen
Standardgruppe `shared`. Am 26.09. um 15:29:26 UTC meldete ausschließlich
`duckduckgo` ein CAPTCHA. Die daraus abgeleitete 15-Tage-Schutzfrist blockierte
über diese Gruppe auch Bing, Brave und Google CSE. Der Katalog war kompatibel,
alle gespeicherten Fingerprints stimmten; Budgets waren nicht ausgeschöpft.

`families.mjs` liefert jetzt anhand des gepinnten SearXNG-Katalogs geprüfte
Vorschläge für Bing, DuckDuckGo, Brave, Google CSE, 360search und Wikimedia.
Unbekannte Anbieter benötigen eine explizite Gruppenzuordnung vor Freigabe;
es gibt keinen globalen gemeinsamen Standard mehr. Bestehende Policies werden
beim Start nicht verändert. Eigene gemeinsame Credential-/Providergruppen
bleiben möglich. Das Observatory erklärt die Gruppierung, zeigt eine aktive
Gruppensperre unmittelbar bei der Quelle und nennt die Filterunterstützung.
Öffentliche Suchfehler unterscheiden fehlende Freigaben, Filterabdeckung,
Schutzfristen, Budgetmangel und fehlerhafte Antworten ohne interne Policywerte
oder Admin-Identitäten offenzulegen.

Die einmalige lokale Reparatur `scripts/repair-shared-family.mjs` ist absichtlich
auf den nachgewiesenen Vorfall begrenzt. Standardmäßig erstellt sie nur eine
Vorschau. Anwendung erfordert `--apply --revision=<geprüfte Revision>`, einen
gestoppten Search-Dienst und dessen exklusives `owner.lock`. Sie verweigert die
Reparatur bei aktiven Reservierungen, verändertem Katalog, unklarer Attribution
oder weiteren aktiven enginebezogenen Schutzfristen. Vor der Änderung erstellt
sie ein geschütztes SQLite-Backup im Datenvolume. Anbieterzähler werden
konservativ übertragen, die gesamte DuckDuckGo-Gruppensperre bleibt wirksam,
ebenso alle ursprünglichen Health-Guards, der alte shared-Guard und globale
Budgets. Einzelne Policies laufen durch den normalen validierten und auditierten
Mutationspfad mit Akteur `maintenance:shared-family-repair`. Es werden keine
neuen Quellen freigegeben, Filter abgesenkt oder Paging-Freigaben erfunden.

Die Nachrichtenkategorie bleibt bei SafeSearch=1 eingeschränkt: `bing news`
meldet im Backend keine SafeSearch-Unterstützung und DuckDuckGo bleibt gesperrt.
Eine zusätzliche SafeSearch-fähige Nachrichtenquelle benötigt weiterhin eine
bewusste administrative Freigabe. Dieses Verhalten ist kein Kategorienfehler.

Nachweise: `evidence/control-plane/provider-family-*`; RMT-Compile-Check über
den lokalen XTend MCP. Domänentests prüfen Isolation, Geschwistersperren,
Budgetübernahme, verweigerte unsichere Reparaturen und konkrete Suchfehlermeldungen.
