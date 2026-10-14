# MVC-Audit XTend.search 0.6.0

## Baseline und Umfang

Baseline ist main `51a30470f6c7edbe5e8dfddc6589284ae6c83c0c`: vollständiger 0.6.0-Wetterstand `bf3c8f6` plus die divergierten main-Abhängigkeitsupdates und korrigierter SSR-Browsertest. Der Refactor-PR richtet sich gegen main. AGENTS.md wurde im Repo und den verfügbaren Eltern-/Agent-Verzeichnissen gesucht; keine Datei vorhanden. Keine weitere main-Mutation, kein Deployment.

Die tatsächlichen Build-Importgraphen für Standalone, Host, XScaler, Admin und Login liegen in `evidence/mvc/*-browser-graph.json`. Baseline-Graphen und alle 81 lexikalischen Kandidaten einschließlich falsch positiver Daten-/Lesefundstellen sind vollständig erhalten. Der AST-Architekturcheck untersucht zusätzlich **alle** eigenen Frontend-/Admin-Dateien, auch indirekte Helfer und lokale Service-Implementierungen.

## Architektur vorher / nachher

Vorher erzeugten DOM-Factory, eigene Lightbox-Fork, About- und Admin-Guard-Controller Views und schrieben Attribute, Text, Formwerte und Sichtbarkeit. Favicon- und Feedback-Controller dekorierten DOM nachträglich.

Jetzt besitzen RMT-Deskriptoren Struktur, Wiederholungen, Text, Attribute, bedingte Dialoge, Busy-/Draft-/Feedback-Zustand und Medien. Registrierte Maraca App Services orchestrieren Feedback, Drafts, Guard, Preferences, Favicon-Cache/Projektion und Streams; reine Service-Cores sind unabhängig testbar. Controller verbinden Events und Modell-/PageClient-Ports. Die native XToggle-Einheitenprojektion sowie serverseitige Wetterableitungen bleiben erhalten. Kein zusätzlicher Renderer oder Router.

Carousel-Positionen werden erst nach dem zugehörigen Vorschau-Commit veröffentlicht. Escape bleibt der geöffneten Modalebene zugeordnet; ein enger Focus-Port stellt bei verlorener Projektion den Fokus auf dem vorhandenen Framework-Dialogcontainer wieder her, ohne einen eigenen Focus-Trap zu implementieren.

Die Stream-Commands verwenden den öffentlichen SDK-Transport als Pull-Iterator und warten auf jeden PageClient-Commit. Die gepinnte Registry-Streamqueue wäre bei Verschachtelung eager; sie wird deshalb nicht als zweite Streamqueue eingesetzt. Abort, Invocation-/Page-Epoch und Terminalprüfung verhindern stale Commits. Observatory-Live-Streams prüfen ihre Scope-ID vor jedem Commit und verbinden nach begrenzter Pause erneut.

## Capability-Grenzen

Browser-I/O liegt in `frontend/browser-capabilities.mjs`: Focus und Scroll über benannte Ports. Einzige DOM-Property-Ausnahme ist `nav.scrollLeft` in `category-tabs.mjs`; sie restauriert die horizontale Tab-Scrollposition. Das Architektur-Gate begrenzt diese Ausnahme auf Datei, Receiver und Property. Native Event-/History-/Visibility-/Observer-Lesezugriffe bauen keine Views. Admin-Panel-Geometrie nutzt bestehende öffentliche XTend-Komponentenmethoden, Draftwerte und Modalattribute sind RMT-owned.

Die gepinnte XAlert-Komponente bietet kein öffentliches `autofocus=false`. Der Adapter nutzt `alert-shown`, stellt nach deren Focus-Microtask Fokus **und Scrollposition** wieder her und schreibt nicht in den Shadow DOM. Geschlossene Overlay-Surfaces erhalten deklarativ keine Container-Paddingreserve. Der unveränderte Wetter-CLS-Test prüft diese Regression.

Die eigene Lightbox-Fork wurde entfernt; ein Framework-XDialog liefert Chrome und Fokustrap, während der Carousel-Service das Modell und RMT Bild/Captions/Navigation besitzen. Unvertrauenswürdige Bildtitel stehen ausschließlich in RMT-Text-/Alt-Bindings; der XDialog-Titel ist statisch, weil seine Framework-Chrome intern HTML interpoliert.

## Vollständige Baseline-Fundstellen

Maschinenlesbar mit Quellzeile und Importpfad: `evidence/mvc/audit-findings.json`. „Kein Sink“ bezeichnet lexikalische Treffer auf lokale Variablen, reine Reads oder serverseitige escaped HTML-Strings; diese werden nicht als behobene App-Verstöße gezählt.

| Datei:Zeile | Runtime-Pfad | Treffer | Bewertung |
|---|---|---|---|
| frontend/category-tabs.mjs:8 | standalone | scrollLeft= | verbleibender enger Scroll-I/O-Adapter |
| frontend/filter-motion.mjs:6 | standalone | open= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/filter-motion.mjs:8 | standalone | open= | behoben |
| frontend/motd.mjs:9 | standalone | value= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/dom.mjs:3 | standalone, admin, host | createElementNS, createElement | behoben |
| frontend/dom.mjs:4 | standalone, admin, host | setAttribute( | behoben |
| frontend/dom.mjs:5 | standalone, admin, host | append(, createTextNode | behoben |
| frontend/components/x-search-report-assistant.mjs:8 | standalone | append( | behoben |
| frontend/feedback.mjs:27 | standalone | checked= | behoben |
| frontend/feedback.mjs:39 | standalone | append( | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/feedback.mjs:68 | standalone | .classList. | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/favicons.mjs:4 | standalone | src= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/favicons.mjs:6 | standalone | createElement, src=, .classList., append( | behoben |
| frontend/favicons.mjs:7 | standalone | src= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/favicons.mjs:8 | standalone | src= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| shared/about.mjs:3 | standalone | value= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| shared/about.mjs:20 | standalone | src= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| shared/about.mjs:22 | standalone | href=, hidden= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| shared/about.mjs:23 | standalone | href=, hidden= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/about-dialog.mjs:9 | standalone | createElement | behoben |
| frontend/about-dialog.mjs:10 | standalone | className=, setAttribute(, setAttribute(, setAttribute( | behoben |
| frontend/about-dialog.mjs:12 | standalone | append( | behoben |
| frontend/about-dialog.mjs:17 | standalone | append( | behoben |
| frontend/about-dialog.mjs:20 | standalone | .style., .style. | behoben |
| frontend/about-dialog.mjs:21 | standalone | inert= | behoben |
| frontend/about-dialog.mjs:24 | standalone | inert=, .style. | behoben |
| frontend/images.mjs:21 | standalone, host | src= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/search-lightbox-controller.mjs:17 | standalone, host | createElement, className= | behoben |
| frontend/search-lightbox-controller.mjs:18 | standalone, host | append( | behoben |
| frontend/search-lightbox-controller.mjs:21 | standalone, host | append( | behoben |
| frontend/search-lightbox-controller.mjs:25 | standalone, host | inert=, .style. | behoben |
| frontend/search-lightbox-controller.mjs:26 | standalone, host | .style., .style., inert= | behoben |
| frontend/search-lightbox-controller.mjs:30 | standalone, host | removeAttribute(, setAttribute( | behoben |
| frontend/search-lightbox-controller.mjs:31 | standalone, host | textContent=, textContent=, textContent= | behoben |
| frontend/search-lightbox-controller.mjs:32 | standalone, host | href=, hidden=, href= | behoben |
| frontend/search-lightbox-controller.mjs:33 | standalone, host | disabled= | behoben |
| frontend/search-lightbox-controller.mjs:34 | standalone, host | setAttribute(, setAttribute( | behoben |
| frontend/search-lightbox-controller.mjs:50 | standalone, host | removeAttribute(, removeAttribute(, removeAttribute(, removeAttribute( | behoben |
| frontend/search-lightbox-controller.mjs:61 | standalone, host | removeAttribute(, textContent= | behoben |
| frontend/search-lightbox-controller.mjs:67 | standalone, host | setAttribute( | behoben |
| frontend/search-lightbox-controller.mjs:68 | standalone, host | removeAttribute(, setAttribute( | behoben |
| frontend/search-lightbox-controller.mjs:69 | standalone, host | textContent= | behoben |
| frontend/search-lightbox-controller.mjs:70 | standalone, host | setAttribute( | behoben |
| frontend/search-lightbox-controller.mjs:93 | standalone, host | textContent= | behoben |
| frontend/search-lightbox-controller.mjs:94 | standalone, host | disabled= | behoben |
| frontend/search-lightbox-controller.mjs:96 | standalone, host | remove( | behoben |
| frontend/components/x-search-lightbox.mjs:88 | standalone, host | append( | behoben |
| frontend/components/x-search-lightbox.mjs:179 | standalone, host | src = | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/components/x-search-lightbox.mjs:196 | standalone, host | .classList., remove( | behoben |
| frontend/components/x-search-lightbox.mjs:229 | standalone, host | .classList. | behoben |
| frontend/components/x-search-lightbox.mjs:248 | standalone, host | .classList., remove( | behoben |
| frontend/components/x-search-lightbox.mjs:253 | standalone, host | removeAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:282 | standalone, host | toggleAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:288 | standalone, host | src = | behoben |
| frontend/components/x-search-lightbox.mjs:290 | standalone, host | src = | behoben |
| frontend/components/x-search-lightbox.mjs:297 | standalone, host | hidden = | behoben |
| frontend/components/x-search-lightbox.mjs:298 | standalone, host | toggleAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:299 | standalone, host | inert = | behoben |
| frontend/components/x-search-lightbox.mjs:300 | standalone, host | setAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:308 | standalone, host | setAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:309 | standalone, host | setAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:360 | standalone, host | appendChild( | behoben |
| frontend/components/x-search-lightbox.mjs:363 | standalone, host | setAttribute( | behoben |
| frontend/components/x-search-lightbox.mjs:374 | standalone, host | insertBefore( | behoben |
| frontend/components/x-search-lightbox.mjs:377 | standalone, host | remove( | behoben |
| frontend/components/x-search-lightbox.mjs:391 | standalone, host | removeAttribute( | behoben |
| frontend/lightbox.mjs:3 | standalone, host | createElement, className=, append( | behoben |
| frontend/alerts.mjs:9 | standalone, host | removeAttribute( | behoben |
| frontend/standalone-host.mjs:45 | standalone | value= | behoben |
| admin/live.mjs:41 | admin | .dataset.geometry= | behoben |
| admin/live.mjs:42 | admin | toggleAttribute( | behoben |
| admin/live.mjs:47 | admin | .dataset.hostReady= | behoben |
| admin/live.mjs:55 | admin | disabled= | behoben |
| admin/live.mjs:60 | admin | checked=, value= | behoben |
| admin/live.mjs:67 | admin | disabled= | behoben |
| admin/live.mjs:74 | admin | createElement, setAttribute(, setAttribute(, setAttribute( | behoben |
| admin/live.mjs:75 | admin | append( | behoben |
| admin/live.mjs:76 | admin | append( | behoben |
| admin/live.mjs:77 | admin | value=, remove( | behoben |
| frontend/streaming.mjs:43 | host | value= | kein Browser-DOM-Schreibsink (Daten/Lesen/SSR-String) |
| frontend/admin-login.mjs:7 | login | hidden=, hidden= | behoben |

## Framework und Upstream

Die tatsächlich ausgelieferten generierten Maraca-Runtime-/Stack-/Komponentenmodule einschließlich aller gebündelten HTML-Sinks sind in `evidence/mvc/generated-runtime-audit.json` erfasst. Upstream-Datei-/Zeilenfunde stehen vollständig in `evidence/mvc/upstream-html-sinks.json`. Framework-Renderer-/Komponenten-HTML-Sinks sind in `evidence/mvc/framework-html-sinks.json` separat dokumentiert. Sie sind XTend-owned und bleiben legitime Renderergrenzen; eigene Komponenten erhalten keine automatische Ausnahme. Die Buildgraphen enthalten den gepinnten XTend-Kernel, RMT-Renderer und Komponentenchunks. SearXNGs client/simple-Code ist kein Import der eigenen XTend-Entrypoints; der explizite Classic-/Native-Fallback besitzt seine eigene Upstream-Runtime und wird separat betrachtet.

## Architektur-Gate und Grenzen

`tests/control/app-dom-architecture.test.mjs` verbietet HTML-Parser/-Sinks, Node-Erzeugung/Mutation, View-Property-Writes und appseitige Rendererfabriken. Es erkennt statische computed Calls (`node["setAttribute"]`), einfache lokale Methoden-Aliase, Destructuring, bind und call/apply sowie Aliasverkettung. Es ist kein vollständiger interprozeduraler Taint-Analyzer und löst beliebige dynamisch berechnete Methodennamen nicht auf. Negative Regressionen prüfen die tatsächliche Reichweite.

## Review-Regressionen

Favicon-Pending-Einträge besitzen Promise und Owner-Signal. Nach Abort wird ein neuer Request sofort unabhängig gestartet; das alte finally darf den neuen Slot nicht löschen. Modellprojektion wird coalesced und anhand der tatsächlichen Favicon-Felder sowie eines Inhaltsfingerprints geprüft: Maraca liefert geklonte Modellwerte, sodass Referenzvergleich keine gültige Stale-Prüfung wäre. 200 parallele Projektionsanforderungen, identische Cache-Hits, geklonte Modellreads und Navigation vor dem alten finally sind gezielt getestet.

Der Wetter-CI-Fehler an 77bdd5f57 wurde mit unveränderten Geometrie-/CLS-Gates reproduziert und eingegrenzt: Overlay-Container-Padding verschob den Board-Start um 64px; XAlert-Autofokus scrollte zur später eintreffenden DWD-Warnung. Die Korrektur entfernt ausschließlich die leere Layoutreserve und restauriert Scrollposition zusammen mit Fokus. Die Assertions behalten ihren Schwellenwert von 0.001.

## MCP-Evidenz

XTend MCP wurde tatsächlich aus `/workspace/xtend/products/xtend-mcp` über token-authentifiziertes Streamable HTTP verwendet: Tool-/Resource-/Template-Discovery, Vertragsreads zu Maraca AppServices, RMT, API, Orchestration, SSR/PageClient/Resumability und Hydration sowie Knowledge-Abfragen. Ein angefragter nicht existierender Binding-URI ist als Diagnose erhalten; keine behauptete erfolgreiche Ressource. Stdio schlug fehl, HTTP funktionierte.

`evidence/mvc/xtend-mcp-checks.json` enthält für alle drei aktuellen RMT-Dateien Compile-/Planstatus, Diagnosen und tatsächliche MCP-Input-Hashes/Provenienz. Vollständige IRs verbleiben nur im lokalen Scratch-Verzeichnis. Vertrags- und Discovery-Evidenz bleiben nachvollziehbar.

## Prüfung

Die finalen tatsächlich ausgeführten Prüfungen und Einschränkungen werden in `evidence/mvc/final-tests.json` dokumentiert. Test-Gates wurden nicht entfernt oder abgeschwächt.
