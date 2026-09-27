# Ergebnisstreaming mit XScaler – XTend.search 0.2.0

## Entscheidung und Protokoll

Die resumierte Search-SPA verwendet den echten `createXScalerAppServiceTransport` aus dem gepinnten XTend-0.8.0-Paket. Ein Remote-Adapter für `remoteSurface:search.results` wird nach XScaler-Preflight über den SDK-Browserloader mit SHA-256-SRI geladen. ATC verwaltet Attach, Cancel, Detach und Dispose. Die Ergebnisfläche und ihr DOM bleiben im Maraca-/RMT-Owner der Anwendung.

Die Streamframes heißen im vorhandenen SDK **`xtend.maraca.app-service-stream-frame.v1`**. Sie sind der AppService-Vertrag, den auch der XScaler-Transport verwendet; ein separates erfundenes `xscaler-search-frame`-Format gibt es nicht. Die Framefelder, Invocation-/Correlation-IDs, Sequenzen, Deduplizierung und Terminalzustände werden vom SDK verwaltet. Es werden weder ein eigener Browser-NDJSON-Parser noch eine SSE-Eigenimplementierung verwendet.

Der Remote-Adapter nutzt `createHttpAppServiceTransport`. Der Backendadapter veröffentlicht seinen Service mit `defineServerServices` und `createNodeAppServiceHost` am gleichen Ursprung unter `POST /api/xtend/services/search.results`. HTTP bildet hier die Verbindung des XScaler-Surface-Adapters zum Such-Core; es wird keine zweite Suchoberfläche geladen.

## Ablauf

1. Native Dokumentanfragen liefern weiterhin vollständiges SSR mit signiertem Resume-Seed. Ohne JavaScript bleibt die Suche vollständig benutzbar.
2. Bei einer resumierten Navigation liefert der Page-Host sofort Suchzustand, Ladeflächen und eine neue Stream-ID. Dieser Schritt startet noch keine Engine-Abfragen.
3. Der Page-Client übernimmt URL, Titel, Filter, History und die Ergebnisfläche. Der Streamadapter startet einmalig den zur ID gehörenden XScaler-AppService.
4. Nach bestandenem Preflight und erfolgreicher SRI-Prüfung ruft der Remote-Adapter den Node-AppService auf. Dessen Generator startet genau eine Python-Suche.
5. Der private Pythonadapter kopiert nach eintreffenden Engine-Batches den Ergebniscontainer. Er verwendet die normalen Engine- und Pluginpfade. Er sortiert ausschließlich die Kopie; der laufende Originalcontainer wird nicht vorzeitig geschlossen. Eine Queue mit einem Eintrag ersetzt überholte Zwischenstände.
6. Node prüft und normalisiert die privaten Core-Snapshots mit der bisherigen Safe-URL-/Text-/Bildproxy-Grenze und übergibt sie dem SDK als `delta`. Enginewarnungen und Pagination werden erst im finalen Stand veröffentlicht.
7. Der Browser übernimmt die Props durch die öffentliche XTend-Page-Update-API `optimistic(update, mutation)`, hier mit einer leeren Mutation. Es werden ausschließlich bereits empfangene Serverdaten übernommen. Dadurch laufen auch Zwischenstände durch denselben Maraca-Commitpfad, ohne einen eigenen Router oder direkte Ergebnis-DOM-Manipulation. Die URL wird pro Suche einmal navigiert.
8. Das `complete`-Frame enthält den normalen, von SearXNG abgeschlossenen Ergebnisstand inklusive finaler Sortierung, Deduplizierung, Wissenskarten, Warnungen und Pagination. Frühere Treffer sind bis dahin ausdrücklich vorläufig. Es wird keine zweite Vollsuche zum Finalisieren ausgelöst.

SSR-Ausführung von Remote-Modulen bleibt ausgeschlossen. Die normale serverseitige Suche für Dokumentanfragen ist davon unabhängig. Das Laden des XScaler-Adapters wird nur für lokale Loopback-Adressen ausdrücklich über HTTP erlaubt; entfernte Origins benötigen HTTPS.

## Abbruch, History und Medien

Eine neue Navigation bricht die aktuelle Registry-/ATC-Session und die HTTP-Verbindung ab. Alte Stream-IDs dürfen keinen neuen Seitenzustand überschreiben. Der Node-Host überträgt das Abbruchsignal an seinen Python-Request. Der Pythonadapter beendet die Veröffentlichung; bereits laufende Engine-HTTP-Anfragen können noch bis zu ihrem vorhandenen Timeout laufen. Es werden keine Pythonthreads gewaltsam beendet.

Back/Forward bleibt im XTend-Page-Client. Eine auf 20 Einträge begrenzte Scrollpositionshilfe im Arbeitsspeicher wiederholt die Wiederherstellung, sobald die nachgeladenen Treffer genügend Höhe haben. Nutzereingaben beenden diese verzögerte Wiederherstellung. Suchergebnisse werden dafür nicht dauerhaft gespeichert.

RMT-Ergebnisidentitäten bleiben stabil. Bildauswahl und offene XLightbox bleiben während Zwischenständen erhalten. Das Carousel erhält die später eintreffenden Bilder, ohne das gerade sichtbare Bild neu zu laden. Fehlerplatzhalter und geschlossene XAlerts bleiben innerhalb desselben Streams erhalten. Die endgültige Rankingreihenfolge kann sich durch spätere Quellen ändern; identische Reihenfolge bereits vor Suchabschluss wird nicht versprochen.

Eine neue Suche versucht zuvor gesperrte Bilder erneut. Thumbnail-Elemente erhalten dafür einen RMT-Key mit einer Generation pro Suchlauf; innerhalb des Streams bleibt dieser Key stabil. So kann der Renderer keine fehlgeschlagenen Bildelemente aus einer vorigen Suche wiederverwenden, während laufende Downloads innerhalb des Streams erhalten bleiben. Bei dynamischen Bildern gilt ausschließlich ein beobachtetes Ladefehlerereignis als Fehlerbeleg: Firefox kann neue Lazy-Images vor Anfragestart vorübergehend mit `complete=true` und Breite null melden. Alte Fehlerbeobachtungen werden beim Suchwechsel verworfen. Der frühe SSR-Zustand wird einmal geprüft, um Fehler vor dem Resume abzufangen. Der Wiederholungsfall wird pro Browser viermal geprüft.

Firefox hielt im reproduzierten Fehlerfall eine gescheiterte 403-Bildanforderung auch mit neuen Elementen und `Cache-Control: no-store` fest; eine neue HTTP-Anfrage unterblieb. Deshalb bekommen Thumbnail- und Preview-Proxy-URLs zusätzlich `xtend_attempt` mit der Suchgeneration. Der Parameter bleibt in allen Batches derselben Suche gleich. Das Proxyziel `url` und die dazugehörige HMAC-Signatur `h` bleiben unverändert, und der Zusatz wird nicht an die Bildquelle weitergegeben. Die SearXNG-Signaturprüfung bleibt vollständig erhalten. Der negative Netzwerknachweis liegt in `evidence/tests/streaming/image-retry-negative.json`.

## Fehler und Rückfall

- Schlägt Preflight, SRI oder die Verbindung vor nutzbaren Treffern fehl, folgt genau ein herkömmlicher SPA-Besuch mit `X-XTend-Stream: off`; kein erzwungener Dokumentreload.
- Bricht der Stream nach nutzbaren Treffern ab, bleiben diese sichtbar. Ein schließbarer XAlert kennzeichnet den unvollständigen Stand.
- Unerwartetes EOF ohne Terminalframe wird als Fehler behandelt, nicht als erfolgreicher Suchabschluss.
- Initial-SSR, native Formulare und `/classic/` bleiben vorhanden.
- `XTEND_STREAMING=0` schaltet den Streamserver und frühe SPA-Antworten gemeinsam ab.

## Betrieb

Das Compose-Image heißt `xtend-search:0.2.0`. Die vorhandenen Schlüsselvolumes bleiben erhalten. Ein expliziter Image-Override ist mit `XTEND_IMAGE` möglich. Streaming ist standardmäßig aktiv.

```sh
docker compose -f compose.xtend.yml build
docker compose -f compose.xtend.yml up -d --no-build --wait
```

Konventionellen SPA-Pfad aktivieren:

```sh
XTEND_STREAMING=0 docker compose -f compose.xtend.yml up -d --no-build --wait
```

Zurück zum Streaming:

```sh
XTEND_STREAMING=1 docker compose -f compose.xtend.yml up -d --no-build --wait
```

Der lokale vorige Image-Stand wurde als `xtend-search:before-xscaler` gesichert. Die produktive Serverinstallation und das veröffentlichte 0.1.0-Installationsarchiv werden durch diese lokale Änderung nicht aktualisiert.

Der Gateway liefert AppService-NDJSON unkomprimiert und mit `X-Accel-Buffering: no`, damit kleine Frames nicht in einem gzip-Puffer hängen bleiben. Ein später vorgeschalteter Reverse Proxy muss das Streaming ebenfalls durchreichen. Der öffentliche Service akzeptiert nur JSON-POSTs, prüft vorhandene Origin-Header, begrenzt Request- und Framegrößen und veröffentlicht keine interne Core-JSON-API. Bildquellen bleiben signiert und werden über denselben Ursprung ausgeliefert.

## Evidenz und Grenzen

- `evidence/mcp/interactions.jsonl`: Knowledge-Context sowie RMT-Compile- und Maraca-Plan-Prüfungen. Der lokale XTend-Checkout und das SDK werden nicht verändert.
- `tests/streaming.mjs`: echte SDK-Transportframes und Browserprüfungen in Chromium/Firefox; schnelle und langsame Offline-Engine, finale Parität, Cancellation, History, no-JS, SRI-Manipulation, unterbrochene Übertragung, XAlert und laufendes Bilder-Carousel.
- `evidence/tests/streaming/results.json`: konkrete Zeitmessungen und echte Loader-/ATC-Zähler. Die Browserzeiten sind lokale Einzelmessungen, keine Produktions-SLA und kein Ersatz für eine Performanceverteilung.
- Bestehende Browser-, Medien-, Alert-, Lightbox- und Bildfehlerprüfungen werden mit aktiviertem Streaming ausgeführt. Tests, die abschließende Ergebniszahlen prüfen, warten nun auf den Suchabschluss statt nur auf den bereits früh verfügbaren Suchzustand.
- Das bestehende JavaScript-Budgetproblem bleibt separat bestehen. Streaming verkürzt die Zeit zu ersten nutzbaren Treffern, nicht automatisch die Laufzeit aller Engines oder den vollständigen Initialdownload.

Während der Entwicklung wies XScaler zunächst einen ungültigen Surface-Identifier und eine unvollständige SRI-Digestdarstellung zurück. Beides wurde an den echten SDK-Vertrag angepasst, statt den Loader oder Preflight zu umgehen. Die erfolgreiche Endprüfung zeigt jeweils `accepted=1`, `loaded=1`, `attached=1`, `activeCount=0` und einen abgeschlossenen Lifecycle.

## Abnahme vom 20.09.2026

Die lokale Compose-Instanz auf `http://localhost:8080` läuft mit `xtend-search:0.2.0`, Image `sha256:87436f07ef27149b002017c7533336ee9503a125afe0f698ad18fe7230b01e6c` (Linux/amd64), und meldet `healthy`. Das bestehende Secret-Volume bleibt eingebunden; UID/GID 10001, read-only Root, entfernte Capabilities und Bindung an 127.0.0.1 wurden überprüft. Die entfernte produktive Serverinstallation wurde nicht aktualisiert.

Die endgültige RMT-Quelle hat SHA-256 `2dd22e872959e114819a09154dc2edaa9c7a2e3afd56b47028bf58f7e458a8cc`. MCP-Compile und Maraca-Plan bestätigen diesen Hash ohne Diagnostics. `evidence/tests/streaming/final-image.json` vergleicht 15 relevante Quell-/Paketdateien mit dem tatsächlich getesteten Container; alle stimmen überein. Die finalen Containerprüfungen liefen ohne Bind-Mounts für Entwicklungscode.

| Prüfgruppe | Ergebnis |
| --- | --- |
| XScaler/AppService und Streaming, Chromium/Firefox | 21 bestanden, einschließlich Wire-Test, SRI, Cancel, EOF, Parität, History, SSR ohne JavaScript und nachgeladenem Carousel |
| Bestehende Browser- und Medienregressionen | 79 bestanden: allgemeine Suche 17, Medien 14, Alerts 14, Shell 8, Lightbox 12, Bildfehler 14 |
| Adapter-/URL-/Proxy-Unitprüfungen | 10 bestanden; insbesondere bleibt die signierte Bildquelladresse beim neuen Ladeversuch unverändert |
| Gateway und Abschaltschalter | 5 Prüfungen bestanden: fremder Origin, falscher Content-Type, gesperrtes öffentliches Core-JSON, deaktivierter Endpunkt und vollständige konventionelle SPA-Antwort |
| Lokaler Live-Betrieb | Web und Bilder mit echten Engines, kein Fixture-Marker, kein Dokumentwechsel, keine JS-Ausnahmen oder direkten Fremdorigin-Browseranfragen |

Nach der letzten Bildproxy-Korrektur wurden Bildfehler-, Medien-, Lightbox- und Streamingprüfungen gezielt erneut ausgeführt. Die allgemeine Such-, Alert- und Shell-Abnahme stammt aus dem davorliegenden Durchlauf derselben XScaler-Implementierung. Negative Vorläufe bleiben als `image-retry-negative.log` und `image-retry-negative.json` erhalten; ein zwischenzeitlicher erfolgreicher Kurztest allein wurde ausdrücklich nicht als ausreichende Abnahme behandelt.

### Zeit bis zu ersten Treffern

Einzelmessungen ohne künstliche Drosselung, keine p95-Werte und keine Produktions-SLA. Die Fixture hat eine zusätzliche Engine mit 1,8 Sekunden Verzögerung. Die Browserwerte erfassen vorhandene Ergebnis-DOM-Elemente bzw. den abgeschlossenen Commit/Lifecycle, keinen eigenständig gemessenen Paint-Zeitpunkt. Vollständige Bilddatei-Downloads können länger dauern als die Ergebnisübertragung.

| Messung | Erste Treffer | Abschluss |
| --- | ---: | ---: |
| Fixture, SDK-Wire | 68 ms | 1.879 ms |
| Fixture, Chromium | 361 ms | 2.239 ms |
| Fixture, Firefox | 464 ms | 2.409 ms |
| Live: `ubuntu`, Web | 928 ms | 5.477 ms |
| Live: `open source`, Bilder | 640 ms | 5.669 ms |

Im Live-Weblauf wurden 40 Treffer angezeigt, im Bildlauf 100; 18 echte proxierte Thumbnails waren bei der Prüfung bereits geladen. Einzelne Suchquellen antworteten nicht und erschienen korrekt als XAlerts. Die ersten Treffer waren trotzdem vor Abschluss aller Quellen nutzbar. Für einen belastbaren Vergleich mit der 0.1.0-/Upstream-Performance fehlt weiterhin eine wiederholte Messreihe unter gleichen Bedingungen; die ältere Baseline in `VERIFICATION.md` bleibt unverändert.

Die aktuelle initiale JavaScript-Inventur beträgt **450,4 KiB gzip**; der bei einer Streaming-Suche geladene Remote-Adapter benötigt zusätzlich **2,8 KiB gzip**. Gegenüber 441,2 KiB vor dieser Erweiterung steigt der Initialdownload um rund 9,2 KiB. Das 150-KiB-Budget bleibt verfehlt. Streaming verbessert hier nachweisbar die frühere Bereitstellung einzelner Suchergebnisse, beseitigt aber weder die große Basis-Runtime noch die Kosten späterer Ergebnis-Commits.

Rohdaten: `evidence/tests/streaming/results.json`, `live.json`, `local-deploy.json`, `edges.json` und die Suite-Logs im selben Ordner. Screenshots: `live-general.png`, `live-images.png`. Reproduzierbare Browserläufe: `TEST_BASE_URL=http://127.0.0.1:8093 node tests/streaming.mjs` gegen eine explizite Fixture-Instanz und `node tests/streaming-live.mjs` gegen die lokale Live-Instanz. Der abgeschlossene Quellstand ist außerdem über `/source.tar.gz` des laufenden Containers verfügbar; die nachträglichen Messprotokolle liegen im Arbeitsverzeichnis.
