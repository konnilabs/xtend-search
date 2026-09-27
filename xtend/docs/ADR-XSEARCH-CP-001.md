# ADR XSEARCH-CP-001 – Standalone XTend.search mit Search Control Plane und Operations Observatory

| Feld | Wert |
| --- | --- |
| Status | **Proposed – zur Architekturfreigabe; Umsetzung erst nach den Preflight-Gates** |
| Datum | 22. September 2026 |
| Produkt | XTend.search |
| Entscheidungseigentümer | Produkt-/Projektverantwortung XTend.search |
| Adressaten | Implementierende Entwickler und Coding Agents, insbesondere Codex / ChatGPT Work |
| Umfang | Containerentkopplung, AppServices, Engine-Routing, Streaming, Knowledge-Fallback, Datenschutz, Admin-Observatory |
| Vorgeschlagener Ablageort | `development/ADR-XSEARCH-CP-001-Standalone-Control-Plane-Observatory.md` |
| Bestehende Architekturgrundlage | XTend `development/ADR-XMS-001-Maraca-AppServices.md` |

**Leitprinzip:** Die Retrieval-Infrastruktur beobachten und steuern, nicht die Suchinhalte oder das Verhalten einzelner Nutzer protokollieren.

Die Bezeichnungen **MUSS**, **DARF NICHT**, **SOLL** und **KANN** markieren Anforderungen dieses ADR. Zahlenwerte sind vorgeschlagene Produkt-Defaults oder Testbudgets, sofern sie nicht ausdrücklich als gemessener Befund bezeichnet sind. Sie sind keine Zusage externer Provider.

---

## 1. Entscheidung in Kürze

XTend.search wird von einem SearXNG-Fork mit integrierter Oberfläche zu einer eigenständig deploybaren Suchanwendung weiterentwickelt. Ein eigener Node-Container betreibt die Maraca-/Resumability-Shell, die serverseitigen Maraca AppServices und eine modular aufgebaute Search-Control-Plane. Ein separater SearXNG-Container bleibt für die Engine-Integration und Retrieval-Ausführung zuständig.

Die Control Plane führt Capability Discovery, administrative Freigaben, Laufzeitbeobachtungen, Request-Budgets und einheitlich modellierte Recovery-Regeln zusammen. Der Planner wählt pro Suche eine begrenzte, geeignete Engine-Gruppe; als Ausgangspunkt gelten drei Websuch-Engines, sofern genügend geeignete und budgetierte Quellen verfügbar sind. Ein eigenes, geschütztes Observatory stellt den Betrieb dar und ermöglicht nachvollziehbare administrative Eingriffe.

**Maraca AppServices bleiben die kanonische Grenze zwischen RMT und Anwendungslogik.** `src/server-services.ts` delegiert an fachliche Module. Routing, Health-Auswertung und Budgetverwaltung werden weder in RMT noch in einem monolithischen Service-Entry implementiert. Für normale serverseitige Datenservices wird der vorhandene JSON-/NDJSON-Vertrag verwendet. XScaler bleibt für tatsächlich deklarierte Remote-Surfaces zuständig; ein gewöhnlicher HTTP-Datenstream wird nicht allein wegen seiner Streaming-Eigenschaft zur XScaler-Remote-Surface. [X1, X2]

**Für den unabhängigen Upstream-SearXNG-Betrieb wird zunächst engine-granulares Streaming über parallel ausgeführte, streng engine-isolierte JSON-Abfragen angestrebt.** Sobald die Antwort einer Engine vollständig verfügbar und validiert ist, kann ihr Ergebnisbatch weitergegeben werden, ohne auf die übrigen Engines zu warten. Das ist kein Einzelresultat-Streaming innerhalb einer noch laufenden Engine. Eine vorhandene engere Streaming-Bridge bleibt als dokumentierter Übergangspfad erhalten, bis der neue Pfad seine funktionalen und operativen Gates bestanden hat.

## 2. Kontext und Evidenzgrenze

### 2.1 Ausgangslage aus der Projektbeschreibung

XTend.search verwendet derzeit nach Angaben des Projektverantwortlichen einen modifizierten SearXNG-Container mit Maraca-Shell, Resumability und einer für Streaming angepassten Middleware-/Adapter-Schicht. Zur Oberfläche gehören unter anderem Knowledge Cards, eine Bild-Sidebar, XAlert und XLightbox.

Im bisherigen Betrieb fallen zwei Integrationsfragen auf: gestreamte Ergebnisse erscheinen subjektiv teilweise gemeinsam, und die Umschaltung von Engines über die bisherigen SearXNG-Einstellungen ist noch nicht zuverlässig verdrahtet. Beide Beobachtungen sind **Untersuchungsaufträge, keine bestätigten Root Causes**. Weder SearXNG noch XScaler, ein Proxy oder die UI-Commit-Schicht werden ohne Messung als Ursache festgelegt.

Die diskutierte Zielrichtung ist eine automatisch verwaltete Engine-Auswahl statt eines obligatorischen Endnutzer-Modals zur Engine-Konfiguration. Endnutzer behalten Einstellungen wie Sprache, Suchkategorie, Safe Search und Darstellung; technische Engine-Policies werden administriert.

### 2.2 Für dieses ADR geprüft

Die XTend-AppServices-Dokumentation und das bestehende ADR XMS-001 wurden im Repository `konnilabs/xtend` am Referenzstand `9128d38177100f28ab31b3335efbf6f67b482791` gelesen. Die Quellen beschreiben getrennte Browser-/Server-Implementierungen, JSON-/NDJSON-Transport, Abort-/Stale-Commit-Regeln und die Abgrenzung zu XScaler. Dies belegt Framework-Verträge, **nicht** die konkrete derzeit deployte XTend.search-Version. [X1, X2]

Geprüfte SearXNG-Grundlagen sind die am 22. September 2026 abgerufene Dokumentation sowie unter anderem `searx/webadapter.py` am Commit `019460e07ddae38aa763869c2dee751ab27e0bba`. Die Dokumentation beschreibt eine HTTP-Such-API mit aktivierbarem JSON-Format und `GET /config`; die Suchimplementierung wartet im regulären Suchpfad auf Engine-Arbeit beziehungsweise Timeouts. SearXNG hat eigene Engine-Suspensions. [S1–S5]

Ein eigenes XTend.search-Repository beziehungsweise die produktive Fork-Implementierung wurde in der verfügbaren GitHub-Suche nicht gefunden. Deshalb wurden **keine bestehende Such-Bridge, Deployment-Datei oder produktlokale Komponente vollständig auditiert**. In diesem ADR vorgeschlagene neue Dateien, Service-IDs und Domänenverträge sind Zielentwurf und dürfen nicht als bereits vorhandene XTend-API behandelt werden.

Es wurden keine Lasttests, Live-Probes gegen Suchanbieter oder Änderungen am produktiven Dienst ausgeführt.

## 3. Ziele, Nichtziele und Grenzen

Ziele sind unabhängig aktualisierbare Container, frühere nutzbare Ergebnisse, stabile UI-Geometrie, bewusster Umgang mit Partial Failures, eine inhaltsfreie Betriebstelemetrie und ein sicher bedienbares Observatory. Engine-Auswahl soll nachvollziehbar, budgetbewusst und pro Ergebnistyp geeignet sein. Knowledge Cards sollen nach Möglichkeit einen überprüfbaren Fallback erhalten.

Nichtziele dieser Maßnahme sind ein eigener Suchindex, eine Neuimplementierung aller SearXNG-Engineparser, Nutzerprofiling, eine Persistenz produktiver Suchinhalte oder eine automatisierte inhaltliche Qualitätsbewertung durch externe LLMs. Es werden weder rotierende Ausgangs-IPs zur Quotenüberschreitung noch CAPTCHA-Umgehungen, versteckte Retry-Schleifen oder ein unbeschränktes Fan-out eingeführt.

Die Maßnahme garantiert weder vollständige Provider-Verfügbarkeit noch unveränderte Trefferqualität bei reduzierter Engine-Anzahl. Mehr Geschwindigkeit und weniger Last können mit geringerer Abdeckung oder anderer Ergebnisreihenfolge einhergehen. Diese Auswirkungen werden getestet, nicht als automatisch positiv vorausgesetzt.

Die erste Ausbaustufe ist ein **modularer Monolith im XTend.search-Container**, keine neue verteilte Plattform mit obligatorischem Kafka, Kubernetes oder separaten Services für jede Zustandsklasse.

## 4. Zielarchitektur und Ownership

```text
                     Öffentlicher Browser
                Maraca / Resumability / Such-UI
                              |
                versionierte AppServices
                    JSON / NDJSON, same origin
                              |
+------------------- XTend.search / Node ---------------------+
| Expliziter Host: HTTP, Auth, SSR, statische Assets, Lifecycle |
|                                                            |
| src/server-services.ts – dünne Anwendungsgrenze              |
|              |                                             |
| SearchApplicationService          AdminApplicationServices  |
|              |                                |            |
| Planner <---- immutable Baseline <---- Control Plane        |
|   |                                  Discovery / Policies   |
|   |                                  Health / Budgets       |
|   |                                  Probe Scheduler       |
|   |                                  Audit / Telemetry     |
|   v                                                        |
| SearchExecutor -> SearXNGAdapter -> ResultNormalizer         |
|                                      |                     |
|                           Stable Presentation Coordinator  |
+-----------------------------|------------------------------+
                              | privates Service-Netz
                    +---------v----------+
                    | SearXNG-Container  |
                    | Upstream-Engines   |
                    | Parser / Timeouts  |
                    | native Suspension  |
                    +---------|----------+
                              |
                     externe Suchanbieter

Geschützter Admin-Browser -> eigene Observatory-Shell/Assets
                          -> autorisierte Admin-AppServices
```

Die Control Plane besitzt **Freigaben, Routingentscheidungen und externe Dispatch-Budgets**. SearXNG besitzt seine Engine-Implementierungen und nativen Schutzmechanismen. Der Adapter übersetzt zwischen beiden, ohne einen zweiten Engineparser-Stack aufzubauen. Der Presentation Coordinator besitzt die Stabilität bereits sichtbarer Ergebnisse, nicht die Providersteuerung.

Die Admin-Shell liegt außerhalb des kritischen Ladepfads der öffentlichen Shell. Ihr Ausfall darf keine laufende Suche stoppen. Sie muss Daten aus denselben kanonischen Services erhalten, die der Planner verwendet; ein zweiter, abweichender Dashboard-Health-Score ist unzulässig.

## 5. Einbindung in Maraca AppServices

### 5.1 Framework-Verträge übernehmen

`src/app.rmt` deklariert Servicebedarf, Modi, Aktionen und Input-Policies. `src/services.ts` bindet lokale Services und Server-Proxies. `src/server-services.ts` enthält die Node-Implementierungen beziehungsweise Delegationen. Der Browser-/Server-Graph wird mit `services.strict: true` getrennt geprüft. Die vorhandenen APIs `defineAppServices`, `defineServerServices`, `service` und die Host-Integration werden verwendet. [X1, X2]

Ein zweiter produktlokaler Dispatcher mit manuellem DOM-Wiring, Zugriffen auf interne `window.__XTend*`-Handles oder parallel nachgebautem AppService-Lifecycle DARF NICHT entstehen. Framework-Concurrency, Abbruchsignale, veraltete Commit-Unterdrückung und Terminalframe-Regeln werden wiederverwendet. Fachliche Budgetierung und Ergebnisdeduplizierung ergänzen diese Regeln, ersetzen sie aber nicht.

Vorgeschlagene produktlokale Service-IDs:

| Service-ID | Modus | Aufgabe |
| --- | --- | --- |
| `search.run` | stream | Suche mit Ergebnis-, Knowledge- und Statusnachrichten |
| `search.capabilities` | query | Öffentliche Suchtypen und tatsächlich unterstützte Filter |
| `preferences.load`, `preferences.save` | query / command | Nur nutzerbezogene Darstellungs-/Suchoptionen |
| `admin.observatory.snapshot` | query | Autorisierter aktueller Betriebs-Snapshot |
| `admin.observatory.events` | stream | Autorisierter begrenzter Live-Eventstream |
| `admin.engine.policy.set` | command | Versionierte Engine-Policy ändern |
| `admin.engine.probe.request` | command | Budgetierte Probe anfordern |
| `admin.routing.mode.set` | command | Validierten normalen/konservativen Betriebsmodus wählen |

Diese IDs sind **neue Produktverträge**, keine bereits existierenden Framework-Funktionen. Authentifizierung und Autorisierung erfolgen im Host und serverseitig pro Aktion; `kind: command` ist keine Berechtigung.

### 5.2 XScaler nicht mit Datenstreaming gleichsetzen

Normale Backend-AppServices sind nach XMS-001 `target: server` und verwenden JSON/NDJSON. Tatsächliche Remote-Surface-Adapter verwenden `target: remote-surface` und den bestehenden XScaler-Vertrag inklusive Preflight, Origin-/Integritätsprüfung und Fallback. [X1, X2]

Bestehende XTend.search-Remote-Surfaces dürfen bestehen bleiben. Die Migration muss aber feststellen, welche Arbeit Datenservice und welche Remote-Surface ist. Ein Suchdatenstream wird nicht über eine neue Remote-Code-Grenze geleitet, nur um das Etikett „XScaler“ beizubehalten. Umgekehrt darf vorhandene Remote-Surface-Sicherheit nicht durch direkte Dynamic Imports umgangen werden.

### 5.3 Host und Hintergrund-Lifecycle

Der explizite Node-Host startet die Domänendienste einmal. Ein Health-Monitor wird nicht je Request, beim Import eines mehrfach geladenen Moduls oder je SSR-Render gestartet.

Startreihenfolge: Konfiguration validieren, persistierte Policies und Sperrfristen laden, Schema-/Adapterkompatibilität prüfen, Baseline veröffentlichen, Suchservices aktivieren, anschließend budgetiertes Monitoring starten. Die Shell darf bei gestörtem SearXNG bereits eine ehrliche Degraded-Ansicht liefern.

Bei SIGTERM: keine neue Arbeit annehmen, Streams kontrolliert beenden, neue Probes stoppen, laufende Arbeit innerhalb einer begrenzten Drain-Phase abschließen/abbrechen und persistente Policy-/Audit-Schreibvorgänge sichern. Es gibt keine ungebremsten `setInterval`-Überlappungen.

Der existierende SSR-/Resumability-Modus wird erhalten. Ein Resume Seed darf weder Secrets noch interne Engine-Budgets oder Admin-Daten enthalten. Baseline-Discovery und Probe-Suchen dürfen den ersten Shell-Paint nicht blockieren.

## 6. Upstream-SearXNG-Vertrag und Streamingentscheidung

### 6.1 Capability Discovery ist kein Healthcheck

Der Adapter liest `GET /config` und validiert den erhaltenen Katalog. Diese Schnittstelle liefert Konfigurationsdaten, aber keinen vollständigen garantierten Echtzeit-Healthvertrag oder generischen administrativen Schreibzugriff. Fehlende Fähigkeiten werden nicht aus Engine-Namen erraten. Zusätzliche, nicht exponierte Fähigkeiten werden über versionierte Adaptermetadaten und Tests ergänzt. [S2]

Der normalisierte Katalog unterscheidet konkrete `engineId`, Marke/Providerfamilie, Ergebnistypen, Sprach-/Filterunterstützung, Paging, deklarierte Resultformen und Beobachtbarkeit. `google` und `google images` sind beispielsweise unterschiedliche Engine-IDs; ein Markenlabel ist keine ausführbare Engine-Referenz.

Neue, umbenannte oder nach einem Upgrade nicht mehr validierbare Engines sind zunächst **nicht automatisch für Produktion freigegeben**. Ein Konfigurations-Refresh kann keine administrative Sperre löschen.

### 6.2 Engine-granularer Kompatibilitätsmodus

Im Zielmodus dispatcht der Adapter pro freigegebener Engine einen eigenen `POST /search` mit Formularencoding und `format=json`. Das JSON-Format muss in der internen Instanz aktiviert sein. Der Adapter bearbeitet Abschlüsse unabhängig und gibt den ersten validierten Ergebnisbatch unmittelbar weiter. Ein `Promise.all` darf nicht Voraussetzung für die erste Ausgabe sein. Die Such-API und der reguläre Engine-Wartepfad begründen diese Grenze. [S1, S3]

```text
Engine A: SearXNG-Request -> A-Antwort ------> A-Batch zur UI
Engine B: SearXNG-Request -----------------> B-Antwort -> B-Batch
Engine C: SearXNG-Request ------------------------------> Timeout
                           ^
                 kein Warten auf B oder C
```

Die Clientverbindung kann somit fortlaufend Daten erhalten, obwohl jede einzelne SearXNG-Antwort vollständig serialisiertes JSON ist. Es wird **keine künstliche Stückelung einer bereits vollständig abgewarteten Gesamtantwort** als frühes Retrieval-Streaming ausgegeben.

Zusätzlicher Overhead durch mehrere SearXNG-HTTP-Requests, Plugins und Requestkontexte muss gemessen werden. Globale SearXNG-Deduplizierung und Gesamtranking stehen bei getrennten Engine-Abfragen nicht automatisch zur Verfügung; deren produktseitige Ersatzsemantik steht in Abschnitt 10.

### 6.3 Kritisches Gate: tatsächliche Engine-Isolation

Im geprüften `webadapter.py` kann die Kombination von `engines` mit `categories` beziehungsweise `category_*` zusätzliche Engines aufnehmen. Spezifische Suchoperatoren in `q` können die Auswahl ersetzen. Eine leere oder nicht erkannte explizite Auswahl kann wieder in Kategorie-Defaults fallen. [S4]

Der Adapter MUSS deshalb serverseitig eine **verbindliche Allowlist des Ausführungsplans** durchsetzen:

- Keine direkte Übernahme von Browser-Engineparametern, SearXNG-Präferenzcookies, Plugin-Parametern oder beliebigem `engine_data`.
- Konkrete Engine-ID vor dem Dispatch gegen den aktuellen validierten Katalog prüfen. Bei leerer/ungültiger Auswahl keinen Upstream-Request absenden.
- Kategorien intern zur Auswahl nutzen; beim expliziten Engine-Dispatch nicht ungeprüft zusätzlich an SearXNG senden.
- SearXNG-Steueroperatoren wie Engine-/Kategorie-Bangs, externe Bangs und Timeout-Overrides im öffentlichen Suchmodus über einen getesteten Parser erkennen und kontrolliert zurückweisen oder über einen expliziten sicheren Modus behandeln. Normale Suchsyntax wie `site:` nicht pauschal zerstören. Ein einzelner optimistischer Regex ist kein hinreichender Nachweis.
- SearXNG-Antworten auf unerwartete Engine-Attribution prüfen. Das ersetzt **nicht** den Test der tatsächlich ausgelösten ausgehenden Requests.
- Locks, Answerers und Plugins prüfen: sie können Requests verändern oder beantworten, ohne die geplante externe Engine aufzurufen. Solche Fälle sind nicht automatisch ein Engine-Erfolg.

Die Integrationssuite MUSS mit kontrollierten Testengines beziehungsweise aufgezeichnetem Test-Egress beweisen, dass keine ungeplante Engine aufgerufen wird. Falls dies mit dem geprüften Upstream-Stand nicht zuverlässig erreichbar ist, wird der Standalone-Executor nicht freigegeben. Dann bleibt der Legacy-Executor aktiv; eine kleine, versionierte SearXNG-Bridge oder eine Upstream-Erweiterung benötigt eine dokumentierte Anschlussentscheidung.

### 6.4 Native Suspension und begrenzte Beobachtbarkeit

SearXNG besitzt eigene Sperrregeln für Fehler, Access Denied, CAPTCHA und Too Many Requests. Der neue Leitstand darf diese nicht durch kurze lokale Standard-Cooldowns abschwächen. [S5]

Ein HTTP-200 des SearXNG-Endpunkts ist **kein** Beweis erfolgreicher Engine-Ausführung. Ergebnisinhalt, verfügbare Fehlermetadaten und Adaptervertrag werden getrennt ausgewertet. Ebenso ist ein HTTP-429 vom internen SearXNG-Limiter nicht automatisch ein HTTP-429 des externen Providers.

Der unveränderte Backend-Modus stellt möglicherweise keine präzisen Upstream-Laufzeiten, Retry-After-Header oder Suspensions-Endzeiten bereit. Nicht beobachtbare Werte bleiben `null` oder `unknown`. Gemessen wird dann beispielsweise `adapterRoundTripMs`, nicht eine erfundene `providerDurationMs`.

## 7. Engine Registry, Policies und Zustandsmodell

Die Registry verwaltet voneinander unabhängige Dimensionen. Ein einziges `enabled`-Boolean reicht nicht aus.

| Dimension | Beispiele | Eigentümer |
| --- | --- | --- |
| Administrative Policy | `allowed`, `disabled`, zeitlich begrenztes `drained` | Admin-Policy-Service |
| Capability | Web, Images, News, Knowledge, Filter, Sprache, Paging | validierter Katalog + Adapter |
| Beobachtete Gesundheit | `unknown`, `healthy`, `degraded`, `unavailable` | Health-Evaluator |
| Zulassungszustand | `closed`, `open`, `half_open` | Breaker/Budget-Service |
| Inhalt-/Struktur-Quarantäne | aktiv/inaktiv mit kontrolliertem Grundcode | Validator / berechtigter Admin |
| Aktualität | `observedAt`, `validUntil`, Samplezahl, `fresh/stale/unknown` | Registry |
| Ausführungsschutz | lokale Sperrfrist, beobachtete Backend-Suspension, Quotenfrist | Adapter + Budget-Service |

`disabled` und fachliche Quarantäne liegen außerhalb der automatischen Recovery. Ein erfolgreicher Probe-Request kann diese Policies nicht aufheben. Eine zeitliche Admin-Drain-Regel darf nach Ablauf nur die Policy zurücksetzen, nicht automatisch Gesundheit behaupten.

Health wird mindestens nach `backendId + engineId + capability` geführt. Ein funktionierender Web-Endpunkt ist kein Nachweis funktionierender Bildsuche. Providerfamilien erhalten gemeinsame Budget-/Fehlerdomänen, soweit ihre Zugehörigkeit bekannt ist.

Der Planner liest einen unveränderlichen Snapshot mit `registryRevision`, `policyRevision` und `generatedAt`. Eine laufende Suche erhält einen planbaren Stand; neue Sperren werden zusätzlich unmittelbar vor noch nicht ausgeführten Dispatches geprüft. Administrative Notfallsperren verhindern somit neue Requests auch innerhalb eines älteren Plans.

## 8. Health-Ermittlung, Cooldown und Watch Period

### 8.1 Passive Daten zuerst, Probes gezielt

Jede echte Engine-Ausführung aktualisiert inhaltsfreie Betriebszähler und strukturierte Beobachtungen. Aktive Probes ergänzen fehlende oder veraltete Beobachtungen und prüfen Recovery. Sie laufen über denselben SearXNG-Ausführungspfad und dieselbe relevante Egress-/Credential-Domäne wie echte Suchen. Ein direkter HEAD-Request auf eine Anbieter-Homepage ist kein Ersatz.

Probes verwenden einen kleinen kuratierten synthetischen Testkorpus ohne Nutzersuchen. In Events wird nur eine nicht sensible Probe-Klassen-ID erfasst. Sie dürfen weder im Browser erscheinen noch in produktive Ergebniscounts eingehen. Probe- und Realtraffic-Metriken bleiben getrennt sichtbar.

Ein sinnvoller Start ist ein überprüfbarer Katalogrefresh etwa alle fünf Minuten und eine Probe gesunder, ungenutzter Engine-Capabilities etwa alle fünfzehn Minuten mit Jitter. Diese Werte gelten nur, wenn die jeweilige Providerpolicy das zulässt. Bei frischen passiven Daten kann eine Probe entfallen. Ein eigenes kleines globales Probe-Budget begrenzt die Zusatzlast auch bei vielen Engines und bei geringer Nutzernachfrage.

Es gibt höchstens einen Scheduler-Eigentümer pro gemeinsamen Budgetraum. Mehrere Node-Worker oder Replikate dürfen nicht unabhängig denselben Probeplan ausführen.

### 8.2 Einheitliche Semantik, nicht identische Sperrdauer

Die gemeinsame Zustandsmaschine ist:

```text
CLOSED --relevante Fehler/Quotenereignis--> OPEN
OPEN --alle Mindestfristen abgelaufen----> HALF_OPEN / WATCH
HALF_OPEN --ausreichend stabile Evidenz--> CLOSED
HALF_OPEN --erneuter relevanter Fehler--> OPEN

Admin-disabled und Quarantäne: zusätzliche harte Gates außerhalb dieser Maschine.
```

Cooldown ist die Zeit ohne reguläre Dispatches. Watch ist eine begrenzte Wiederzulassungsphase mit wenigen Prüfversuchen. Degraded kann bereits bei erhöhten Latenzen gelten, während der Breaker noch geschlossen ist.

Die nächste erlaubte Ausführung berechnet sich aus dem **Maximum** gültiger Constraints:

```text
nextAllowedAt = max(
  providerRetryAfterAt,
  backendSuspendedUntil,
  localBackoffUntil,
  quotaResetAt
) + nichtnegativer Recovery-Jitter
```

Nicht verfügbare Felder sind keine Null-Sekunden-Sperre. Der Adapter muss aus validierter Backend-Konfiguration beziehungsweise Fehlerklasse eine konservative lokale Frist wählen und diese als abgeleitet kennzeichnen. Ein nicht bekanntes tatsächliches Backend-Sperrende wird im Observatory nicht als präziser Countdown behauptet.

Providerangaben werden nicht auf ein kürzeres lokales Maximal-Backoff gekappt. `Retry-After` kann eine Verzögerung oder ein HTTP-Datum enthalten; die normalisierte Frist berücksichtigt diese Semantik. [H1]

### 8.3 Entscheidungsregeln gegen Flapping

Als initiale, zu kalibrierende Regel kann ein Circuit nach drei aufeinanderfolgenden relevanten technischen Fehlern öffnen. Ein eindeutiges Quoten-/CAPTCHA-Ereignis darf sofort sperren. Fehlerquoten benötigen ein Mindestvolumen, beispielsweise zwanzig echte Ausführungen im betrachteten Fenster. Geringe Samplezahlen werden sichtbar ausgewiesen.

Watch startet mit maximal einer gleichzeitig zugelassenen Ausführung pro Scope. Wiederzulassung erfordert mehrere erfolgreiche Beobachtungen über eine Mindestzeit, nicht nur einen erfolgreichen Ping. Ein beispielsweise zweiminütiges Watch-Fenster und drei erfolgreiche Beobachtungen sind gemeinsame Defaults, keine universell passenden Providerwerte.

Einzelne leere Trefferlisten, Nutzerabbrüche, lokal verworfene Arbeit, erkannte Adapterbugs oder eine überlastete gemeinsame Node-Instanz dürfen nicht pauschal die externe Engine krank melden. Adapter-, Backend- und Providerfehler werden getrennt attribuiert. Bei einem gemeinsamen SearXNG-Ausfall wird zunächst der Backend-Circuit geöffnet, statt jede Engine einzeln zu bestrafen.

## 9. Request-Budgets und Query Planner

### 9.1 Harte Zulassung vor gewichteter Auswahl

Ein Engine-Kandidat ist nur zulässig, wenn administrative Freigabe, passende Capability, erforderliche Filter, Breaker-/Suspensionslage und verfügbare Budgets zusammenpassen. Soft-Scores für Latenz, technische Erfolgsrate, Lastverteilung und bekannte Quellenvielfalt wirken erst danach. Ein hoher Score kann keine Sperre überstimmen.

Aus geeigneten Kandidaten wird ohne Zurücklegen gewichtet ausgewählt. Der Planner berücksichtigt Alter und Aussagekraft der Telemetrie; selten genutzte Engines werden über das Probe-/Watch-Budget überprüft, statt dauerhaft wegen fehlender Daten zu verhungern. Eine Markenvielfalt allein belegt keine unabhängigen Indizes oder Ausfalldomänen.

Vorgeschlagenes Startprofil:

| Policy | Startwert / Regel |
| --- | --- |
| Web-Primärziel | 3 geeignete Engines, bei Mangel weniger |
| Knowledge-Primärpfad | höchstens 1 geeigneter Provider bei passender Anfrage |
| Gesamtbudget pro Suchlauf | höchstens 5 Engine-Dispatches über alle Lanes |
| Zusätzliche Fallbacks | insgesamt höchstens 1 nach bereits gestarteten Primärpfaden; Budget immer prüfen |
| Wiederholung derselben Engine | standardmäßig keine automatische Wiederholung im Suchlauf |
| Progressive Fan-out / Hedging | zunächst ausgeschaltet; Freigabe erst nach Last-/Qualitätstest |

Das Gesamtlimit ist die harte Grenze. Beispielsweise verbrauchen drei Web-Engines und ein Knowledge-Provider vier Dispatches; nur ein zusätzlicher Fallback bleibt übrig. Unverbrauchte Knowledge-Kapazität wird nicht automatisch in unbeschränkte Web-Fan-outs umgewandelt.

### 9.2 Budgethierarchie

Es werden Rate- und Parallelitätsgrenzen auf Engine-, Providerfamilien-/Credential-, relevanter Egress- und Dienstebene berücksichtigt. Alle Zugriffe über gemeinsame Quotenräume müssen entweder durch diese Budgetierung laufen oder konservativ berücksichtigt werden. Direkte fremde Zugriffe auf dieselbe SearXNG-Instanz können die Baseline ansonsten entwerten.

Ein Token-Bucket oder gleichwertiger zugelassener Algorithmus reserviert Budget **atomar vor dem Dispatch**. Mehrere gleichzeitige Anfragen dürfen nicht denselben letzten Token verwenden. Bereits versendete Arbeit verbraucht Budget auch bei Timeout oder Clientabbruch. Unverbrauchte Reservierungen dürfen kontrolliert freigegeben werden.

Ein SearXNG-Request kann intern zusätzliche HTTP-Aufrufe erzeugen, etwa für Token, Bilder oder Redirects. Die Node-Schicht darf daher nicht behaupten, ein Dispatch sei exakt ein externer HTTP-Request. Der Adapter dokumentiert beobachtete beziehungsweise konservativ geschätzte Requestkosten; Nachladepfade wie Knowledge, Autocomplete und Bildproxy werden separat berücksichtigt.

Die Lastverteilung reduziert pro Engine nur den Anteil des Traffics. Drei Engines pro Nutzersuche verursachen weiterhin ungefähr drei primäre Engine-Ausführungen; bei gleichmäßiger Auswahl aus fünf Engines liegt der durchschnittliche Anteil je Engine bei drei Fünfteln der Nutzersuchen. Die Middleware erzeugt keine zusätzliche Gesamtquote.

Bei erschöpften Budgets: begrenzt warten, weniger Engines verwenden oder ehrlich mit Überlastungsstatus ablehnen. Keine unbeschränkte Warteschlange und kein reflexhaftes Ausweichen auf weitere Provider. Ingress-Abuse-Schutz ergänzt Egress-Budgetierung; das eine ersetzt das andere.

### 9.3 Deadlines und Cancellation

Jeder Suchlauf besitzt eine totale Deadline, einen begrenzten Queue-Anteil und Lane-/Engine-Deadlines. Knowledge darf das Web-Settlement nicht endlos blockieren. Fallbacks starten nur mit ausreichend Restzeit und Budget. Es gibt keine kumulativen Retries über Browser, AppService, Adapter und SearXNG ohne gemeinsame Kostengrenze.

Ein AbortSignal beendet lokale Reads, geplante Arbeit und nachfolgende UI-Commits. Ob ein abgebrochener HTTP-Request die laufende SearXNG-/Providerarbeit tatsächlich stoppt, muss separat geprüft werden. Bei fehlender End-to-End-Cancellation gelten die externen Requests weiter als verbraucht; deren mögliche Restlaufzeit wird bei In-flight-Limits konservativ berücksichtigt.

## 10. Resultatfluss, Deduplizierung, Ranking und Pagination

Die produktlokalen Payloads von `search.run` unterscheiden mindestens `search.started`, `results.batch`, `knowledge.updated`, `source.status` und `search.summary`. Der bestehende AppService-Transport liefert genau einen Terminalframe (`complete`, `error` oder `cancelled`). Die Fachpayload `search.summary` ist kein zweiter Terminalmechanismus. [X1]

Jeder Batch ist einer gültigen Invocation zugeordnet. Wiederholte oder verspätete Nachrichten dürfen keine doppelten Treffer oder Cross-Query-Commits erzeugen. IDs/Sequenzen des Frameworks bleiben requestbezogen und werden nicht in dauerhafte Nutzerkorrelationsschlüssel umgewandelt.

Im Standalone-Modus besitzt XTend.search die engineübergreifende Zusammenführung. Folgende Regeln gelten:

1. Ergebnisse werden typisiert normalisiert, URLs sicher geprüft und vor dem Commit dedupliziert. Bei URL-Normalisierung werden nur belegbar irrelevante Trackingparameter entfernt; semantische Parameter bleiben erhalten.
2. Providerinterne Reihenfolge wird als Signal erhalten. Scores unterschiedlicher Provider werden nicht ungeprüft numerisch verglichen. Ein dokumentiertes rangbasiertes Verfahren oder eine einfache deterministische Interleaving-Policy wird anhand synthetischer Fixtures geprüft.
3. Bereits sichtbare Treffer behalten innerhalb des Suchlaufs ihre Position und stabile Identität. Späte Duplikate können reservierte Attribution ergänzen, dürfen aber die Karte nicht unkontrolliert vergrößern.
4. Eine neu berechnete globale Rangfolge wird **nicht automatisch beim Streamabschluss auf die sichtbare Liste angewendet**. Neuordnung erfordert eine ausdrückliche Nutzeraktion oder einen neuen Suchlauf.

Dieser Kompromiss priorisiert frühe Nutzbarkeit und Layoutstabilität gegenüber jederzeit perfekter globaler Sortierung. Ein kurzes, begrenztes Initialfenster zur Batchbildung ist möglich, darf aber die erste Ausgabe nicht künstlich bis zum Ende aller Engines verzögern.

Pagination führt die Engine-Auswahl eines Suchlaufs nicht bei jeder Seite neu aus. Ein kurzlebiger, serverseitig authentifizierter Continuation-Vertrag kann Engineplan, Ablaufzeit, Version und Seitenfortschritt transportieren; keine Suchinhalte müssen dafür dauerhaft serverseitig gespeichert werden. Der Browser sendet die Query für Folgeseiten erneut. Token-Manipulation, neue Sperren und erschöpfte Budgets werden serverseitig geprüft. Fehlende Engines erzeugen markierte Teilabdeckung, keine stillschweigende vollständige Neusuche mit anderem Pool.

Bei planabhängiger Rangfusion sind Duplikate über Seitengrenzen, Engine-Cursor, Safe-Search-Grenzen und die Weitergabe von SearXNG-`engine_data` explizite Vertragsprüfungen. Ein universelles `pageno + 1` wird nicht für jede Engine unterstellt.

## 11. Layoutstabilität bis zum Paint

**Invariante:** Neue Daten dürfen bereits dargestellten relevanten Inhalt nicht ohne bewusste Nutzeraktion verschieben. Ein abschließendes globales Re-Ranking ist deshalb kein automatischer Settlement-Schritt.

Der Presentation Coordinator nimmt Batches unabhängig entgegen und bündelt DOM-Commits framebezogen mit einem gemessenen Arbeitsbudget. Er besitzt eine begrenzte Queue; er wartet nicht auf alle Engines und erzeugt keine künstliche Ergebnisanimation mit festen Wartezeiten. Die vorhandene Maraca-Identität und Reconciliation werden genutzt.

Die UI MUSS insbesondere Folgendes sicherstellen:

- Reservierte Media-Geometrie, feste Bildseitenverhältnisse und zum finalen Layout passende Ladezustände. Eine bloße `min-height` garantiert bei längeren Titeln/Snippets keine Stabilität.
- Desktop-Knowledge-Sidebar mit von Beginn an stabiler Spaltenentscheidung. Spätes Einblenden darf nicht nachträglich die Breite der Ergebnisliste und deren Zeilenumbrüche ändern.
- Mobile Knowledge-Darstellung in vorreservierter Geometrie oder einer explizit geöffneten separaten Surface/Overlay. Kein nachträgliches Einschieben über gelesenen Treffern.
- Ein reservierter Statusbereich für Degraded-/Quellenmeldungen. Fehlende Knowledge-Daten oder ausfallende Engines erzeugen keine nachträgliche Banner-Verdrängung.
- Auch beim Append werden Footer, Pagination und sichtbare nachgelagerte Elemente berücksichtigt. „Nur anhängen“ allein beweist kein CLS von null.
- Unverbrauchte Skeleton-Slots werden nicht während des Lesens so entfernt, dass sich sichtbare Elemente verschieben. Variable Inhalte benötigen eine getestete Geometrie- beziehungsweise Nutzerexpansionsstrategie.

Offizielle CLS-Messung wird durch Bounding-Box-Assertions für bereits sichtbare Treffer ergänzt. Verschiebungen im zeitlichen Umfeld von Nutzereingaben dürfen nicht lediglich wegen einer Metrik-Ausnahme als gute UX gelten. Layoutreservation ist die technische Grundlage, kein Ersatz für Browsermessung. [U1]

Das Testziel für kontrollierte Streaming-Fixtures ist **kein unerwarteter Layoutshift**. Der zuvor berichtete lokale Shell-Kaltstart ist keine Feldbaseline für Ergebnisstreaming und kein Beweis fehlender Verschiebungen bei späteren Ergebnissen.

## 12. Knowledge-Provider und Fallbacks

Knowledge Cards werden gegen einen normalisierten Capability-Vertrag gebaut, nicht gegen ein obligatorisches Wikipedia-Responseformat. Ein internes Modell enthält mindestens Titel, optionale Kurzbeschreibung, optionale strukturierte Fakten, optionale Medien sowie prüfbare Quellen-/Lizenzangaben und Entitätsbezug.

Der Resolver trennt `not_applicable`, `not_found`, `ambiguous`, `available` und `temporarily_unavailable`. Kein Treffer für eine konkrete Query ist kein Engineausfall. Eine mehrdeutige Entität darf nicht allein wegen des nächsten verfügbaren Providers mit einer zufälligen Karte gefüllt werden.

Wikipedia und Wikidata können Kandidaten sein: SearXNG dokumentiert beide mit Infobox-Unterstützung. Wikidata ist eine strukturierte Wissensbasis, nicht automatisch ein Ersatz für einen Wikipedia-Artikeltext. [K1, K2]

Vorgesehene Fallbackleiter:

```text
Primärprovider mit passender Capability und Entitätszuordnung
    -> alternativer freigegebener Provider, sofern Fehlerdomäne/Budget passen
    -> reduzierte, korrekt attribuierte Faktenkarte
    -> reservierter Zustand „keine gesicherten Zusatzinformationen verfügbar“
```

Wikipedia/Wikidata werden nicht als garantiert unabhängige Fehlerdomänen behandelt. Ein parserbezogener Ausfall kann einen Wechsel sinnvoll machen; ein gemeinsames Netzwerk-/Wikimedia-Limit kann beide Pfade treffen. Ein Fallback darf keine geltende gemeinsame Rate-Sperre umgehen. Mehrere Wikimedia-Endpunkte sind keine zusätzlichen frei verfügbaren Quoten. Provider-Etikette wird eingehalten. [K1, K3]

Quellen werden pro Feld oder logisch zusammenhängender Gruppe erhalten. Widersprüche werden nicht still zu scheinbar gesicherten Fakten verschmolzen. Ein fehlender Artikeltext wird nicht durch einen ungeprüften Suchsnippet oder generierten Text als gleichwertiges Wikipedia-Wissen ausgegeben.

Es gibt im MVP keinen persistenten suchabhängigen Knowledge-Cache. Ein späterer Cache öffentlicher Entitäten benötigt eine eigene Festlegung zu Revisionsstand, Lizenz, TTL und Zugriffsspuren. Ein technischer Last-good-Health-Snapshot ist kein Resultatcache.

## 13. Beobachtbarkeit: Events, Metriken und Qualität

### 13.1 Standardisiertes Eventformat

Operative Events verwenden einen **CloudEvents-1.0-Envelope** mit produktspezifischem, versioniertem Datenschema. CloudEvents standardisiert das Eventformat; es verlangt keinen Event-Broker. Das Format kann lokal validiert, gespeichert und über AppServices transportiert werden. [E1]

Beispiel eines neuen Produktvertrags, nicht eines vorhandenen XTend-Runtime-Events:

```json
{
  "specversion": "1.0",
  "id": "0c6b84c7-e304-4a09-9198-e50f65ee911a",
  "source": "urn:xtend:search:control-plane:instance-a",
  "type": "de.ccs-networks.xtend.search.engine.observed.v1",
  "time": "2026-09-22T15:53:00.000Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:xtend:search:schema:engine-observation:v1",
  "data": {
    "backendId": "searxng-primary",
    "engineId": "wikipedia",
    "capability": "knowledge",
    "origin": "live",
    "outcome": "success",
    "errorClass": null,
    "measurementScope": "adapter_round_trip",
    "durationMs": 184,
    "providerDurationMs": null,
    "validResultCount": 1,
    "validation": "schema_valid",
    "policyRevision": 12,
    "retryNotBefore": null,
    "retryNotBeforeSource": null
  }
}
```

Erlaubte Eventfamilien umfassen Engine-Beobachtung, Health-/Circuit-Transition, Budget-Exhaustion, Probe-Ergebnis, Capability-Änderung, Backend-Kompatibilitätsfehler, Policy-Änderung und Telemetrieverlust. Schemas erlauben nur bekannte Felder mit begrenzten Werten und Größen; unbekannte Rohfelder werden nicht ungeprüft durchgereicht.

Eventzeit wird in UTC gespeichert, Laufzeiten mit monotoner Zeit gemessen. Event-ID ist keine User-/Session-/Query-ID. Eine lokale Store-Sequenz dient als Resume-Cursor im Adminstream. Konsumenten deduplizieren über `source + id`; eine globale Exactly-once-Zustellung wird nicht behauptet.

### 13.2 Technische Güte ist nicht semantische Relevanz

Automatisch messbar sind Schema-/Parsergültigkeit, passender Resulttyp, gültige sichere URLs, fehlende Pflichtfelder, unterstützte Sprache/Filter, Latenzen, Fehler und Duplikatanteile. Diese Kennzahlen können in Memory aus Resultaten berechnet werden; Resultinhalte werden anschließend nicht in das Event übernommen.

**Nicht zulässig ist die Gleichsetzung `HTTP 200 + viele Treffer = hohe inhaltliche Qualität`.** Geringe Trefferzahl ist bei seltenen Suchbegriffen normal. Inhaltliche Zielgruppeneignung und redaktionelle Qualität werden über einen nicht personenbezogenen kuratierten Testkorpus und nachvollziehbare Admin-Policies geprüft. Keine automatische Sperre allein aufgrund einer einzelnen leeren Liste oder geringer Klickzahlen.

Eine technische Quarantäne hat einen klaren Grundcode, etwa `wrong_result_type`, `unsafe_url_scheme` oder `schema_invalid`. Eine dauerhafte redaktionelle Entscheidung verwendet einen getrennten Grundcode wie `audience_mismatch` oder `insufficient_editorial_quality` und einen dokumentierten synthetischen Testbezug.

### 13.3 Kennzahlen

Das Observatory zeigt mindestens Fehlerquoten mit Samplezahl/Zeitfenster, frische/stale Baseline, erfolgreiche und fehlgeschlagene Ausführungen, p50/p95 der tatsächlich gemessenen Latenz, In-flight-Arbeit, Budgetdruck, Skip-/Fallback-Gründe, Knowledge-Verfügbarkeit und Telemetrieverlust.

Nutzerorientierte Pipeline-Metriken werden getrennt geführt: Zeit bis zum ersten nutzbaren Ergebnis, Zeit bis zum nutzbaren ersten Ergebnissatz, Settlement-Zeit, Engine-Roundtrip und Gateway-/Queue-Overhead. Ein Serverevent „Batch geschrieben“ ist nicht gleichbedeutend mit „im Browser gepaintet“.

Histogramme und Fehlerzähler verhindern, dass Timeouts durch ausschließliche Betrachtung schneller Erfolge unsichtbar werden. Erfolgs-Latenzquantile werden ausdrücklich als solche bezeichnet. Quantile werden nicht durch Mittelwertbildung aus p95-Werten mehrerer Teilfenster berechnet. Es gibt keine hochkardinalen Labels mit Queries, URLs oder beliebigen Fehlermeldungen.

## 14. Privacy-by-Design und Speicherung

### 14.1 Verbotene Persistenz

Nicht in operative Logs, Traces, Metriklabels, Event Store, Dumps oder Backups gehören produktive Queries, deren Hashes, Ergebnis-URLs/-Titel/-Snippets, Query-abgeleitete Entity-IDs, Cookies, IPs, User-/Session-IDs, vollständige Request-/Response-Bodies oder Zugangsdaten. Auch ein Query-Hash ist kein erlaubter Ersatz für die Query.

Request-Inhalte dürfen nur solange im Arbeitsspeicher leben, wie Verarbeitung, Pagination im Client oder unmittelbare Ausgabe dies erfordern. Keine Default-Suchhistorie in Local Storage, Service Worker Cache oder serverseitigem Session Store. Technisch unvermeidbare Verarbeitung ist von dauerhafter Speicherung zu unterscheiden; absolute forensische Löschung aus jedem Runtime-Speicher wird nicht zugesagt.

Die Log-Policy gilt **für die gesamte Kette**: Reverse Proxy, Node, Maraca-Diagnose, HTTP-Client, SearXNG/Webserver, Containerlogs, APM/OpenTelemetry und Fehlerreporting. Such-GETs, falls für Browserintegration erhalten, benötigen Query-Redaktion vor jedem Log-Sink. POST allein verhindert keine Body- oder Exception-Leaks. [P1, P2]

Automatische Instrumentierung, die `url.full`, `url.query`, Requestbodies oder Query-haltige Exceptiontexte erfasst, bleibt deaktiviert oder wird vor Erfassung strikt eingeschränkt. Öffentliche Resultat- und Adminantworten sind nicht cachebar; Assetcaches werden separat erlaubt. Eine geeignete Referrer-Policy verhindert Weitergabe von Such-URLs an verlinkte Quellen. Bild-/Favicon-Anfragen werden ebenfalls auf mögliche Drittanbieterleaks geprüft.

### 14.2 Drei getrennte Datenklassen

| Datenklasse | Inhalt | Vorgeschlagene Aufbewahrung |
| --- | --- | --- |
| Flüchtiger Suchlauf | Query, Ergebnisse, temporäre Invocation-Korrelation | nur laufzeitgebunden; kein persistenter Store |
| Operative Telemetrie | zugelassene Engine-/Backendmetadaten, Transitionen, Histogramme | rohe Beobachtungen höchstens 48 Stunden; aggregierte Minutenfenster 30 Tage |
| Admin-Audit | Akteur, erlaubte Aktion, Ziel-Engine, Policyrevision, Grundcode, Ergebnis | 180 Tage als Produkt-Default |

Diese Zeiten sind Architektur-Defaults, keine Behauptung gesetzlich erforderlicher Aufbewahrungsfristen. Policy-Konfiguration und aktuelle harte Sperren sind dauerhafter Betriebszustand und nicht an die 48-Stunden-Eventrotation gebunden.

Alle Beobachtungen können den In-memory-Evaluator aktualisieren. Routine-Erfolge dürfen bereits beim Persistieren aggregiert oder begrenzt gesampelt werden; Fehler-/State-Transitionen bleiben nachvollziehbar. Rohdaten haben zusätzlich eine absolute Größen-/Mengenobergrenze. Die Store-Rotation darf den Dienst nicht durch unbegrenztes Wachstum gefährden.

Exakte Timestamps und Betriebsmetadaten sind nicht automatisch anonym. Zugriff bleibt administrativ beschränkt; keine Veröffentlichung eines detaillierten requestnahen Eventfeeds. Es gibt keine gemeinsamen dauerhaften IDs, mit denen Suchnutzer, Suchlauf und Engineevents zusammengeführt werden können.

Admin-Akteure werden für echte Verantwortlichkeit identifiziert, aber in einem separaten Auditkontext. Freitext-Auditbegründungen sind standardmäßig ausgeschlossen; sie könnten versehentlich Nutzersuchen enthalten. Kontrollierte Grundcodes und Verweise auf synthetische Tests reichen im MVP aus.

Ingress-Abuse-Schutz kann kurzlebige In-memory-IP-Buckets benötigen. Diese sind kein Bestandteil des Observatory und werden nicht persistiert. Trusted-Proxy-Konfiguration verhindert gespoofte Client-IP-Header. Die private Backend-Anbindung darf nicht dazu führen, dass SearXNG sämtliche legitimen Anfragen fälschlich als einen ungeschützten öffentlichen Client behandelt. [S6]

### 14.3 Durchsetzung statt Absichtserklärung

Ein zentraler Event-Factory-/Schema-Layer erstellt erlaubte Metadaten aus expliziten Feldern. `console.log(request)`, rohe Exceptions und beliebige Providerobjekte sind in Produktionspfaden unzulässig. Ein künstlicher Canary-Suchbegriff wird durch Erfolg, Timeout, Invalid JSON, Redirect, Abbruch und Auth-Fehler geführt. Alle persistenten Sinks einschließlich Container- und Proxylogs werden danach auf Query, URL-Encoding und übliche Escapeformen geprüft.

## 15. Operations Observatory und manuelle Eingriffe

Das Observatory ist eine eigenständige geschützte Maraca-Surface mit separatem Ladepfad. Standardkomponenten werden wiederverwendet; Custom-Komponenten stellen beispielsweise Engine-Matrix, Budgetbalken, Zeitreihen und Eventtimeline dar. Namen konkreter noch nicht vorhandener Komponenten werden erst nach Prüfung des Produktcodes festgelegt.

Ansichten sind Dienstübersicht, Engine-/Capability-Pool, Fehler-/Latenzverlauf, Cooldown/Watch, Budgetauslastung, Ereignisse, Policy-/Auditverlauf und Backend-Kompatibilität. Jede Healthanzeige enthält Alter, Messscope und Samplezahl. `unknown` wird nicht als grün dargestellt.

Rollen:

| Rolle | Berechtigung |
| --- | --- |
| Viewer | Betriebszustand und freigegebene Events lesen |
| Operator | zeitliche Drain-Regel, budgetierte Probe, konservativen Betriebsmodus anfordern |
| Administrator | dauerhafte Freigaben/Sperren, Capability-Policies und erlaubte Budgetkonfiguration ändern |

Manuelle Aktionen sind serverseitig validiert, revisionsgebunden, idempotent und auditiert. Änderungen gelten erst als erfolgreich, wenn kanonischer Zustand und Audit atomar persistiert sind. Der Client übernimmt die bestätigte Revision; konkurrierende Änderungen erzeugen einen sichtbaren Konflikt.

„Probe anfordern“ heißt **frühestmögliche zulässige Probe**, nicht sofortiger Zugriff trotz Quoten-/Provider-Sperre. „Cooldown zurücksetzen“ darf höchstens eine lokale administrative Wartepolitik verändern; es darf weder bekannte Providerfristen noch SearXNG-Suspensions oder Quoten zurücksetzen. Eine neue Probe kann Wartung nicht in eine Umgehung von Schutzmaßnahmen verwandeln.

Dauerhafte Engine-Sperren werden zunächst in der XTend-Policy durchgesetzt. Das Observatory schreibt nicht beliebige `settings.yml`-Dateien und startet keine Container über einen Docker-Socket. Ein späterer Upstream-Konfigurationsabgleich wäre ein eigener kontrollierter Deploymentprozess.

Bei Ausfall der Auditpersistenz werden administrative Mutationen abgelehnt. Der Suchdienst kann mit der letzten validierten Policy weiterarbeiten. Bei Ausfall des Adminstreams zeigt die Oberfläche „Verbindung unterbrochen / Stand von …“ und keine scheinbar aktuellen grünen Werte.

## 16. Persistenz, Ausfallsicherheit und Ressourcenbegrenzung

Für das Single-Instance-MVP wird SQLite auf einem dedizierten Volume vorgesehen: getrennte Tabellen für Policyrevisionen, aktuelle Sperrfristen, Admin-Audit, begrenzte operative Events und Aggregationen. WAL-/Busy-/Checkpoint-Verhalten und Datenträgerfehler werden getestet. Ein synchroner umfangreicher DB-Zugriff darf den Node-Eventloop nicht blockieren; der konkrete Driver beziehungsweise ein begrenzter Storage-Worker wird anhand der verwendeten Node-Version ausgewählt.

Der Such-Hot-Path liest In-memory-Snapshots. Telemetrie wird über eine begrenzte Queue asynchron geschrieben. Bei vollen Queues darf niedrig priorisierte Telemetrie verworfen/aggregiert werden; der Verlust wird gezählt und sichtbar. Healthentscheidungen im laufenden Prozess dürfen nicht davon abhängen, dass jeder Telemetriedatensatz bereits auf Platte liegt.

Policies und deren Audit benötigen Transaktionen. Dieses ADR fordert keine vollständige Event-Sourcing-Architektur. Nicht jedes Engineevent wird zu einem dauerhaft replaybaren Suchlauf.

Beim Neustart bleiben administrative Sperren, bekannte Quotenfristen und konservative Budgetzustände erhalten. Ein Neustart erzeugt keine neuen Providerquoten. Veraltete Healthdaten werden als stale/unknown geladen und kontrolliert revalidiert. Ist keine vertrauenswürdige Policy verfügbar, arbeitet der Dienst fail-closed für Engine-Dispatches; eine verständliche Shell bleibt erreichbar.

Ein Telemetrieausfall führt nicht automatisch zu einem Totalausfall der Suche. Der konservative Weiterbetrieb darf aber ausschließlich bereits validierte Freigaben und sicher verfügbare Budgets verwenden. Lässt sich die Quotenlage nicht zuverlässig bestimmen, wird weniger oder gar nicht dispatcht.

Horizontaler Betrieb ist **nicht** durch das Starten weiterer identischer Container freigegeben. Dafür braucht es gemeinsame atomare Budget-/Sperrverwaltung und einen Leader/Lease für Probes. Ein Redis-/Valkey-/Datenbank-Backend kann später hinter vorhandenen Interfaces hinzukommen; es ist kein obligatorischer Teil dieses MVP.

## 17. Deployment, Sicherheit und Upgrades

Der öffentliche Ingress zeigt auf XTend.search. SearXNG ist nur im privaten Service-Netz erreichbar; sein Port, Konfigurationsendpoint und eventuelle Metrikendpoints werden nicht ungeprüft veröffentlicht. Netzwerkregeln trennen Service-Erreichbarkeit und erlaubten Internet-Egress: ein vollständig egressloses Netz wäre für Retrieval ungeeignet.

Node und SearXNG verwenden getrennte Images und unabhängig versionierte Konfiguration. Die konkrete Node-Basis wird auf eine von der eingesetzten XTend-Version unterstützte Version gepinnt; der geprüfte XMS-ADR nennt Node 24 als Floor. Ein Framework-Upgrade ist nicht stillschweigender Bestandteil dieses Produktrefactors. [X2]

Images laufen mit minimalen Rechten, ohne Docker-Socket im Anwendungscontainer, mit begrenzten CPU-/Memory-Ressourcen und nur den erforderlichen beschreibbaren Volumes. Secrets bleiben serverseitig. Interner Netzwerkstandort allein ist keine hinreichende Vertrauensprüfung; Authentisierung und bei hostübergreifender Kommunikation passende Transportabsicherung gehören zum Deploymentvertrag.

Adminzugang verlangt echte serverseitige Authentifizierung und rollenbezogene Autorisierung, beispielsweise über die vorhandene SSO-/OIDC-Infrastruktur mit MFA. Cookiebasierte Mutationen sind CSRF-geschützt. RMT-Inputvalidierung ergänzt das, ersetzt Auth/CSRF aber nicht. Admin-Daten werden nicht in öffentliche Resume Seeds oder gemeinsam gecachte Antworten eingebettet.

SearXNG-Antworten sind untrusted Input: Größenlimits, JSON-/Schemavalidierung, URL-Schemata, HTML-Sanitizing beziehungsweise Textdarstellung und sichere Medienverarbeitung gelten auch im internen Netz. Ein Bildproxy muss SSRF, Redirects auf interne Ziele und DNS-Rebinding berücksichtigen; die Browser-UI darf nicht zu einem generischen internen Fetch-Proxy werden.

**Automatische Upstream-Aktualisierung bedeutet nicht ungeprüftes Ersetzen von `latest` in Produktion.** Aktualisierungen werden zunächst gegen Adapter-, Isolations-, Privacy- und Streaming-Verträge geprüft, anschließend mit bekanntem Digest promoted und rückrollbar gehalten. Watchtower oder ein anderer Updater darf ein Staging-/Benachrichtigungswerkzeug sein; der Produktionspfad benötigt einen Freigabeschritt. Ein fehlerhafter neuer SearXNG-Stand darf die geprüfte Kombination nicht automatisch überschreiben.

Liveness prüft den Node-Prozess. Readiness und eine getrennte betriebliche Capability-Anzeige unterscheiden „Shell/API kann antworten“ von „Web/Knowledge liefert derzeit Resultate“. Ein einzelner externer Engineausfall soll keine Container-Restart-Schleife auslösen.

Lizenz-/Attributionsprüfung für SearXNG-Modifikationen und Knowledge-/Medienquellen ist ein Release-Arbeitspaket; eine Containergrenze allein entscheidet keine Lizenzfrage.

## 18. Migration in freigabefähigen Phasen

### Phase 0 – Bestandsaufnahme und Protokoll-Spike

Lokale XTend.search-Codebase, aktuelle Build-/Imageversionen, Fork-Patches, Streaming-Bridge, Settings-Pfade und Security-/Resume-Verträge erfassen. Mit synthetischen Requests Zeitpunkte Engineabschluss, Adaptereingang, Streamwrite, Browserempfang und UI-Commit messen. Proxy-/Kompressionsbuffering prüfen. Das separate Engine-JSON-Modell gegen die gepinnte SearXNG-Version mit echter Egress-Isolation validieren.

**Gate G0:** Evidenzbericht mit Ursache/Unklarheiten des aktuellen Burst-Verhaltens und positivem oder negativem Ergebnis zur Engine-Isolation. Keine Umstellung bei unbewiesenem Protokollvertrag.

### Phase 1 – Node-Container und AppService-Grenze

Eigenen Host, strikt getrennte Browser-/Server-Builds und dünne AppServices etablieren. Zunächst darf ein LegacyProvider-Adapter gegen den bestehenden kombinierten Backend-Stand laufen. Shell, CSS, Navigation und Funktionen möglichst unverändert übernehmen. Kein gleichzeitiger visueller Komplettumbau.

**Gate G1:** bisherige Produktfunktionalität und Resumability erhalten; keine Secrets im Browser; dokumentierter sofortiger Rollback.

### Phase 2 – Registry, passive Telemetrie und Read-only Observatory

Eventschemas, Privacyfilter, Policy-Store, Capability-Snapshot und passiven Health-Evaluator bauen. Das Observatory zeigt zunächst nur verifizierte Beobachtungen. Ein Shadow-Planner berechnet Pläne ohne zusätzlichen externen Traffic.

**Gate G2:** Privacy-Canary sauber, validierte Quellenattribution, nachvollziehbare Snapshots. Kein implizites Doppelretrieval für Shadow-Messungen.

### Phase 3 – Standalone-Executor und begrenztes Routing

Engine-isolierten Upstream-Modus aktivieren, Budgetierung, Deadlines, append-stabiles Merge und Pagination implementieren. Zunächst synthetische und ausdrücklich freigegebene Testlast, anschließend kontrollierter produktiver Rollout. Legacy-Executor bleibt als Rollback verfügbar.

**Gate G3:** frühe echte Batches, keine ungeplanten Engineaufrufe, Budgetkonformität und geprüfte Suchqualität/Abdeckung für Zielkategorien.

### Phase 4 – Recovery, Probes und Knowledge-Fallback

Native Suspensions normalisieren, aktive Probes budgetieren, Watch/Cooldown aktivieren und Knowledge-Fallbacks integrieren. Manuelle Probe-/Drain-Aktionen freigeben.

**Gate G4:** keine Flapping-/Probe-Stürme, keine Umgehung von Providerfristen, eindeutige Knowledge-Entitäten und Attribution.

### Phase 5 – Schreibendes Observatory und Cutover

Dauerhafte Admin-Policies, RBAC, atomisches Audit, Backups, Betriebsrunbooks und Upgrade-Smokes fertigstellen. Nutzerseitige Engine-Einstellungen entfernen beziehungsweise kontrolliert auslaufen lassen; alte Cookies dürfen das neue Routing nicht beeinflussen. Harte Userfilter wie Sprache/Safe Search werden bewusst migriert.

**Gate G5:** alle Abnahmekriterien, Betriebsfreigabe, Datensicherung und getesteter Cutover/Rollback. Erst danach die alte kombinierte Deploymentvariante stilllegen.

### Phase 6 – Optionale Optimierungen

Progressive Fan-out, Hedging, unabhängige zusätzliche Knowledge-Provider oder Shared-State-Skalierung jeweils separat messen und freigeben. Sie sind keine Voraussetzung für den Basis-Cutover und kein Anlass, unkontrolliert den MVP-Umfang zu erweitern.

## 19. Abnahmekriterien und Testmatrix

| ID | Szenario | Erforderlicher Nachweis |
| --- | --- | --- |
| A01 | Drei Testengines antworten nach 100 / 700 / 2.500 ms | Erster Batch ist vor Abschluss der zweiten/dritten Engine im Browser sichtbar; nicht nur früh im Serverlog |
| A02 | Proxy, Kompression und normaler Deploymentpfad aktiv | A01 bleibt erfüllt; keine verdeckte Gesamtantwortpufferung |
| A03 | Append, späte Knowledge Card, Bildnachladen, Fehlerbanner | Kein unerwarteter Layoutshift; Bounding Boxes bereits sichtbarer Treffer bleiben stabil |
| A04 | Streamabschluss mit später besser geranktem Treffer | Kein automatisches Reordering, kein unerwarteter Fokus-/Scrollverlust |
| A05 | Neue Suche während altem Stream | Alte Invocation kann keine Daten in die neue Surface committen |
| A06 | Duplicate Frames, unterbrochener Stream, Invalid JSON | Keine doppelten Treffer; ein gültiger Terminalzustand; kontrollierte Fehlermeldung |
| A07 | Engineauswahl mit Kategorien, Bangs, Cookies, unbekannter/leer gewordener Engine | Tatsächlicher Test-Egress enthält ausschließlich zulässige Engines oder der Request wird vor Dispatch abgelehnt |
| A08 | HTTP-200 mit Enginefehler / nativer Suspension | Kein falscher Erfolg; richtige Fehlerklasse oder ausdrückliches `unknown` |
| A09 | Quotenheader/nativer Cooldown länger als lokaler Default | Keine Anfrage vor der längsten gültigen Mindestfrist, auch nicht via Admin-Probe |
| A10 | Gleichzeitiger Zugriff auf den letzten Budgettoken | Höchstens eine atomar erfolgreiche Reservierung; keine Überbuchung |
| A11 | Keine geeigneten Engines oder alle Budgets leer | Ehrlicher Empty/Unavailable/Overload-Zustand ohne verstecktes Full-Fan-out |
| A12 | SearXNG-Container nicht erreichbar | Bereits vorhandene UI bleibt nutzbar; Backendfehler statt pauschaler Engineabwertung |
| A13 | Clientabbruch | Keine neuen Dispatches/Commits; externe Restarbeit wird nicht als kostenlos beendet verbucht |
| A14 | Neuanlauf während Cooldown / DB nicht lesbar | Sperren bleiben erhalten; bei fehlender Policy keine neuen Enginefreigaben |
| A15 | Neuer Backendkatalog nach Update | Neue Engine nicht automatisch freigegeben; unbekannter Vertrag stoppt Promotion |
| A16 | Knowledge-Primärprovider fällt aus | Richtige alternative/verminderte Karte oder ehrlicher Fehlzustand; kein Entitätswechsel |
| A17 | Providerübergreifender gemeinsamer Rate-/Netzfehler | Fallback über dieselbe Fehler-/Quotendomäne umgeht keine Sperre |
| A18 | Canary-Query in allen Fehlerpfaden | Keine Suchinhalte/identifizierenden Daten in persistenten Sinks einschließlich Proxy-/Containerlogs |
| A19 | Adminmutation ohne Rolle / ohne CSRF-Schutz / mit alter Revision | Ablehnung ohne Zustandsänderung; sichtbarer Konflikt bei Revisionsfehler |
| A20 | Erfolgreiche Adminmutation / defekter Auditstore | Zustand und Audit atomar; bei Auditfehler keine bestätigte Änderung |
| A21 | Langsamer Adminstream / voller Eventstore | Bounded Memory, Telemetrieverlust sichtbar; Suchverkehr nicht durch Dashboard blockiert |
| A22 | Pagination mit gesperrter Engine oder manipuliertem Cursor | Policy wird erneut durchgesetzt; keine neuen unzulässigen Quellen, kein stilles Pool-Reshuffle |
| A23 | Shared-State-/Mehrfachprozess-Versuch im MVP | Doppelmonitoring beziehungsweise unabhängige Budgets werden verhindert oder Deployment wird abgelehnt |
| A24 | Mobile View, Tastatur, 200-%-Zoom, Screenreader | Bedienelemente erreichbar; Statusupdates zurückhaltend; kein informationsvernichtendes Clipping |
| A25 | Synthetischer Qualitätskorpus je Kategorie/Sprache/Safe Search | Ergebnisart, Filter, Attribution und vereinbarte Abdeckung erfüllen die freigegebene Baseline |

Die CI arbeitet überwiegend mit deterministischen Fake-Engines und kontrollierten Upstream-Antworten. Live-Provider-Smokes sind budgetiert, gesondert gekennzeichnet und keine Einladung zu Probe-Stürmen. Ein realer Providerausfall wird von einer eigenen Code-Regression unterschieden; eine unbewiesene oder übersprungene Sicherheitsprüfung wird nicht als bestanden markiert.

## 20. Messplan und Performance-Budgets

Vor dem Umbau wird eine reproduzierbare Baseline erhoben: Commit-/Image-Digests, CPU/OS/Browser, Cold Navigation versus Warm Navigation, Cachezustand, Netzprofil, Proxy-/Kompressionskonfiguration und synthetischer Engine-Zeitplan.

Verglichen werden Legacy-Executor, Standalone-Executor mit gleichem Engineplan und Standalone-Executor mit adaptivem Routing. Nur so lassen sich Container-/Adaptereffekt und veränderte Providerwahl unterscheiden. Messungen mit realen Providern ergänzen die Fixtures, ersetzen sie nicht.

Ein erstes internes Ziel ist höchstens 100 ms zusätzlicher p95-Abstand zwischen validiertem erstem Adapterbatch und beobachtbarer Darstellung im kontrollierten Desktop-Test. Ein weiteres Ziel ist höchstens 10 ms p95 zusätzlicher serverseitiger Planner-/Gateway-Verarbeitungszeit ohne Queue-, Provider- und Netzwartezeit. Beide Werte sind zu bestätigende Engineering-Budgets, keine vorliegenden Messergebnisse.

Unter CPU-/Netzdrosselung werden eigene Baselines geführt. Für Routingverbesserungen werden First-useful-result, Gesamtlatenz, Trefferabdeckung und **externe Dispatchkosten pro Suche** gemeinsam ausgewertet. Ein niedriger Latenzwert durch massiven Mehrtraffic oder durch Abbruch aller langsamen Antworten ist kein hinreichender Erfolg.

CLS wird für den ganzen Suchlauf und die relevanten UI-Szenarien erfasst, nicht nur für die Startseite. Long Tasks, Input-Reaktionszeit, Streamqueue, Memory und Stale-Commit-Zähler ergänzen die Messung. Browser-Paint-Evidenz kommt aus instrumentierten Testläufen; requestbezogene Client-Traces werden nicht ungefragt zur produktiven Nutzertelemetrie.

## 21. Rollback und Betriebsrunbooks

Feature-Flags trennen Executorwahl, adaptives Routing, aktive Probes, Knowledge-Fallback und Adminmutationen. Eine Abschaltung adaptiven Routings darf harte Adminsperren und Quoten nicht umgehen. Konservativer Modus bedeutet ein geprüftes kleines Allowlist-Poolprofil, nicht „alle Engines verwenden“.

Vor dem Cutover werden Policy-/Audit-Backup, Datenbankschemaversion und alte Image-Digests gesichert. Schemaänderungen bleiben während der Migration rückwärtsverträglich oder besitzen einen expliziten Restore-Pfad. Automatische destruktive Down-Migrations sind nicht vorgesehen.

Runbooks behandeln mindestens SearXNG-Ausfall, vollständige Budgeterschöpfung, Provider-CAPTCHA, fehlerhafte Capability-Erkennung, veraltete Baseline, Query-Leak-Alarm, defekten Eventstore, falsche Knowledge-Zuordnung und gescheitertes Upstream-Upgrade.

Ein Query-Leak-Alarm führt zur sofortigen Begrenzung/Deaktivierung des betroffenen Log-Sinks und zur kontrollierten Bereinigung gemäß Betriebsvorgaben; Debuglogging mit echten Suchinhalten ist keine normale Reparaturmaßnahme. Ein Upstream-Kompatibilitätsfehler führt zum letzten geprüften Digest beziehungsweise Legacy-Executor, nicht zu ungeprüftem HTML-Scraping als stiller Ersatz.

## 22. Verworfene Alternativen und Konsequenzen

| Alternative | Entscheidung und Grund |
| --- | --- |
| Gesamte Control Plane in `server-services.ts` | Verworfen: Request-Binding, Monitoring und Policylogik würden vermischt |
| Für jeden Teil sofort ein Microservice | Für MVP verworfen: zusätzlicher Betriebs-/Konsistenzaufwand ohne belegten Bedarf |
| Nur eine aggregierte SearXNG-JSON-Abfrage, danach künstliches Chunking | Kein Ersatz für frühes Engine-Streaming |
| Unverändertes SearXNG mit frei angenommenem Result-SSE-Endpunkt | Verworfen: keine unbestätigte Schnittstelle als Implementierungsgrundlage |
| Eigene Parser aller Provider in Node | Verworfen: erhebliche redundante Wartung, Verlust der SearXNG-Arbeitsteilung |
| Regelmäßige Vollprobes aller Engines ohne Budget | Verworfen: Zusatzlast und Risiko selbst verursachter Drosselung |
| Endnutzer müssen Engineprobleme durch Toggles selbst beheben | Nicht Ziel des normalen Produkts; technische Auswahl wird administriert |
| Health = HTTP-200 oder Trefferanzahl | Verworfen: technisch und semantisch unzureichend |
| Automatisches finales Umsortieren sichtbarer Ergebnisse | Verworfen: widerspricht Layout-/Interaktionsstabilität |
| Gemeinsamer LLM-Reranker mit persistenten Queries | Außerhalb des Scopes und des hier festgelegten Privacy-Modells |
| Ungeprüfte automatische Produktionsupdates | Verworfen: kann Adapter-, Privacy- und Isolationsverträge brechen |

Positive Konsequenzen sind eine klarere Framework-/Produktgrenze, kontrollierte Fehlerbehandlung, nachvollziehbare Engineauswahl, unabhängige Deployments und eine Betriebsoberfläche ohne Suchinhaltslogging.

Kosten sind ein eigener, testpflichtiger Merge-/Paginationvertrag, zusätzliche SearXNG-HTTP-Kontexte, ein Policy-/Telemetriestore und die Wartung von Kompatibilitätsfixtures. Latenzoptimierung und Ergebnisabdeckung bleiben ein bewusster Trade-off. Ein inhaltsfreies Observatory besitzt weniger Möglichkeiten zur Diagnose konkreter schlechter Nutzertreffer; dafür werden synthetische Reproduktionen und explizit freigegebene Testfälle verwendet.

## 23. Arbeitsauftrag für die Implementierung und Stop-Regeln

Vor Änderungen lokale Projektinstruktionen und vorhandene ADRs lesen, den tatsächlichen XTend-/SearXNG-Stand erfassen und bestehende Produktfunktionen sichern. Den hier genannten Framework-Referenzstand nicht ungeprüft mit dem installierten Paket gleichsetzen.

Zunächst Phase 0 als eigenständigen Evidenz-/Spike-Commit liefern. Danach in kleinen, überprüfbaren Schritten implementieren. Jede Phase aktualisiert ihren Gate-Status und nennt Tests, Messergebnisse, verbleibende Unsicherheiten und einen Rollback. Neue Produktservices werden über RMT und Maraca AppServices deklariert; ein lokaler Ersatzbootstrap ist kein akzeptabler Shortcut.

**Stop und Architekturentscheidung einholen**, wenn Engine-Isolation nicht sicher ist, Upstream ohne Bridge die notwendige Streaming-/Pagingsemantik nicht liefert, ein Providerlimit nur durch eine Umgehung eingehalten werden könnte, Suchinhalte für Telemetrie persistiert werden müssten oder eine notwendige Änderung XTend-Kernverträge berührt. Ein verbleibender Bridgebedarf wird dokumentiert und versioniert, nicht durch den Begriff „Middleware“ verdeckt.

Zur Freigabe des ADR sind besonders zu bestätigen: produktives XTend.search-Repository, eingesetzter Package-/Image-Stand, konkreter Authprovider, freigegebene Engines je Zielkategorie, deren zulässige Budgets, gewünschte Sprach-/Safe-Search-Policies, Retentionwerte und Hosting-/Egress-Topologie. Die Architektur ist vorgegeben; diese Betriebswerte dürfen nicht erfunden werden.

### Vorgeschlagene Modulstruktur

Die Struktur ist ein Zielvorschlag und wird an vorhandene Repositorykonventionen angepasst:

```text
src/
  app.rmt
  services.ts
  server-services.ts
  search/
    contracts/
    application-service.ts
    planner.ts
    execution-plan.ts
    executor.ts
    result-normalizer.ts
    result-merger.ts
    continuation.ts
    adapters/
      searxng-provider.ts
      legacy-provider.ts
    engines/
      capability-registry.ts
      policy-store.ts
      health-evaluator.ts
      circuit-policy.ts
      budget-manager.ts
      probe-scheduler.ts
    knowledge/
      resolver.ts
      provider-contract.ts
  observability/
    event-schemas/
    event-factory.ts
    privacy-filter.ts
    metrics.ts
    bounded-event-store.ts
  admin/
    services.ts
    authorization.ts
    audit.ts
  ui/
    presentation-coordinator.ts
    components/
server/
  index.mjs
  lifecycle.mjs
  composition-root.mjs
admin/
  src/app.rmt
  src/services.ts
  src/app.css
tests/
  fixtures/
  contracts/
  engine-isolation/
  privacy/
  streaming-layout/
  deployment/
deployment/
  compose.yaml
  config/
  runbooks/
```

Der Servergraph darf diese Domänenmodule importieren; der öffentliche Browsergraph nicht. Die physische Dateiablage allein schützt kein Secret. Strict-Build, Exportgrenzen, Host-Allowlist und Artefaktprüfungen sind Teil der Abnahme.

## 24. Quellen und Referenzstände

Abruf-/Prüfdatum: **22. September 2026**. Repository-Links sind nach Möglichkeit auf den gelesenen Commit gepinnt. Die Quellen belegen externe Verträge und bestehende XTend-Entscheidungen; neue Zahlenbudgets, Service-IDs und Policies dieses ADR sind Produktentscheidungen.

**[X1] XTend – Maraca AppServices und TypeScript.** Geprüfter Stand: `9128d38177100f28ab31b3335efbf6f67b482791`. Browser-/Server-Trennung, NDJSON, Lifecycle und XScaler-Grenze.

`https://github.com/konnilabs/xtend/blob/9128d38177100f28ab31b3335efbf6f67b482791/docs/de/maraca-app-services.md`

**[X2] XTend – ADR XMS-001: Maraca AppServices als kanonische Shell-/Backend-Grenze.** Gleicher Referenzcommit. Architektur-Ownership, Hostverantwortung und Deploymentklassen.

`https://github.com/konnilabs/xtend/blob/9128d38177100f28ab31b3335efbf6f67b482791/development/ADR-XMS-001-Maraca-AppServices.md`

**[S1] SearXNG – Search API.** GET/POST, Formularencoding, aktivierbares JSON und Filter.

`https://docs.searxng.org/dev/search_api.html`

**[S2] SearXNG – Administration API.** Dokumentierter Konfigurationsabruf über `GET /config`.

`https://docs.searxng.org/admin/api.html`

**[S3] SearXNG – Search-Implementierung.** Reguläre Ausführung und Warten auf Enginearbeit beziehungsweise Timeout; kein daraus ableitbarer nativer HTTP-Einzelresultatstream.

`https://docs.searxng.org/_modules/searx/search.html`

**[S4] SearXNG – `webadapter.py`.** Geprüfter Commit `019460e07ddae38aa763869c2dee751ab27e0bba`, insbesondere `parse_generic` und `get_search_query_from_webapp`: Engine-/Kategorieparameter und Suchoperatoren.

`https://github.com/searxng/searxng/blob/019460e07ddae38aa763869c2dee751ab27e0bba/searx/webadapter.py`

**[S5] SearXNG – `search:` settings.** Native Fehler-/CAPTCHA-/Rate-Limit-Suspensions.

`https://docs.searxng.org/admin/settings/settings_search.html`

**[S6] SearXNG – Limiter.** Ingress-Botschutz, Client-IP-Zuordnung und Trusted-Proxy-Konfiguration.

`https://docs.searxng.org/admin/searx.limiter.html`

**[K1] SearXNG – Wikimedia Engines.** Wikipedia-/Wikidata-Infoboxen und teilweise gemeinsame Implementierung.

`https://docs.searxng.org/dev/engines/online/wikipedia.html`

**[K2] Wikidata – Introduction.** Strukturierte Wissensdaten als eigener Datentyp.

`https://www.wikidata.org/wiki/Wikidata:Introduction`

**[K3] MediaWiki – API Etiquette.** Verhalten für ressourcenschonende API-Zugriffe.

`https://www.mediawiki.org/wiki/API:Etiquette`

**[E1] CloudEvents Specification 1.0.2.** Standardisierter Event-Envelope; `specversion` ist `1.0`.

`https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md`

**[H1] RFC 9110, Abschnitt 10.2.3 – Retry-After.** HTTP-Datum beziehungsweise Verzögerung in Sekunden.

`https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after`

**[U1] web.dev – Optimize Cumulative Layout Shift.** Layoutreservation und Ursachen nachträglicher Verschiebungen.

`https://web.dev/articles/optimize-cls`

**[P1] OWASP – Logging Cheat Sheet.** Ausschluss sensibler Daten, kontrolliertes Logging und Prüfung von Logfehlern.

`https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html`

**[P2] OpenTelemetry – HTTP Semantic Conventions.** Zu prüfende HTTP-Attribute und URL-/Query-Erfassung bei Instrumentierung.

`https://opentelemetry.io/docs/specs/semconv/http/http-spans/`

---

**Freigabekriterium der Gesamtentscheidung:** XTend.search kann mit einem unabhängig aktualisierbaren SearXNG-Backend frühe, stabile und korrekt attribuierte Ergebnisse aus ausschließlich freigegebenen, budgetierten Engines ausgeben; der Dienst ist administrierbar, ohne produktive Suchinhalte dauerhaft zu protokollieren. Nicht erfüllte Voraussetzungen bleiben sichtbar und blockieren den jeweiligen Cutover, statt durch unbestätigte Schnittstellen oder simuliertes Streaming verdeckt zu werden.


## Ergänzung 0.4.0

Die ausdrücklich genehmigte, begrenzte Ausnahme für freiwillige Ergebnis-URL-Prüfbelege ist in [ADR-XSEARCH-QUALITY-004](ADR-XSEARCH-QUALITY-004.md) definiert. Ohne aktive Zustimmung bleibt das Inhaltsverbot unverändert.
