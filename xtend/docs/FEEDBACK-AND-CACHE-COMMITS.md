# Feedback-Testvertrag und Ressourcen-Owner bei Cache-Reentry

Baseline: Main `a1914801c798e04ffb4f8a1e62da60de70cda23b`.
PR18 enthält die Feedback-Testbarriere und den anschließend belegten Produktfix
gegen einen stale Favicon-/Thumbnail-Commit. SDK und Dependencies bleiben unverändert.

## Vertrag fixiert, ursprüngliche CI-Ursache nicht bewiesen

`selectOption('spam')` beendet die DOM-Interaktion. Die abgeleitete
Modellfreigabe kann zu diesem Zeitpunkt noch ausstehen: Beobachtet wurden
`reason='spam'`, genau eine Auswahl, aber `canSave=false` und ein deaktivierter
nativer Button. Das v04-Gate synchronisiert deshalb vor allen fünf
`#report-save`-Klicks mit Modell **und** gerendertem XButton:

- `search.feedback`: offen, genau eine Auswahl, `reason='spam'`,
  `canSave=true`, `busy=false`;
- Host und nativer Button vorhanden, ohne `disabled` oder
  `aria-disabled='true'`; native `disabled`-Property ebenfalls false.

Der anschließende Klick sowie alle Toast-, HTTP-Wire-, Opt-in-, erste-Proposal-,
Beleg-Anzahl- und nachfolgenden Assertions bleiben erhalten. Die Barriere
verwendet Playwrights bestehendes Timeout; keine Sleeps oder Retry-Klicks.

Beide fehlgeschlagenen Versuche von
[Main-CI 38549704544](https://github.com/konnilabs/xtend-search/actions/runs/38549704544)
meldeten den Toast-Wait in der Vier-Kontexte-Schleife (`v04-browser.mjs:46:390`
auf der Baseline). Die Beleg-Abfrage in Zeile 47 wurde noch nicht erreicht.
Die CI-Logs beweisen keine konkrete Runtime-, Opt-in- oder Beleg-Scope-Regression.
Die frühere Behauptung eines verlorenen Klicks war nicht belastbar: Ein nach
dem Controller installierter Listener wurde von `stopImmediatePropagation`
unterdrückt; außerdem ist der SDK-Facade eingefroren und lässt sich dort nicht
direkt überschreiben. Dieser Test-Fix behauptet keine bewiesene Remote-Ursache.

## Kontrollierte Regression ohne Timer

Nach dem vollständigen v04-Gate auf einer frischen Fixture:

```sh
TEST_BASE_URL=http://localhost:8093 node xtend/tests/control/feedback-readiness-browser.mjs
```

Der Test umschließt den eingefrorenen Runtime-Facade nur in seiner eigenen
Browser-Session. Er hält den ersten Auswahl-Commit für `reason='spam'` mit
einem explizit freigegebenen Promise zurück. Er prüft den obigen noch nicht
freigegebenen Modell-/Button-Zustand, weist nach, dass die gemeinsame Barriere
bereits während des gehaltenen Commits pollt und noch nicht aufgelöst ist,
gibt den Commit frei und verlangt nach dem normalen Klick den Erfolgstoast.
`PageClient.getRuntime` liefert nur in dieser Browser-Testsession den Wrapper
und wird nach Freigabe wiederhergestellt. Der eingefrorene Facade sowie
produktive Dateien und SDK-Quellen bleiben unverändert.
Der zusätzliche Browser-Check läuft in PR-CI nach v04; alle bisherigen Gates
laufen anschließend weiter.

## Lokale Validierung

Am 14. Oktober 2026 bestanden das vollständige korrigierte v04-Gate und
anschließend der kontrollierte Readiness-Check gegen das neu gebaute,
unveränderte Main-Produktionsbundle mit v05-Backend, OAuth-/Wetter-Fixture,
frischem Docker-Volume und dem CI-Streaming-Gzip-Proxy (Testorigin 8106).
Die kontrollierte Ausgabe bestätigt den gehaltenen Zustand
`{open:true,selected:1,reason:"spam",canSave:false,busy:false,nativeDisabled:true}`
und anschließend `readyClickAccepted:true`. Syntaxprüfungen aller drei
Testmodule und `git diff --check` bestanden ebenfalls. Der endgültige
PR-CI-Link und dessen tatsächliche Ergebnisse stehen in der PR-Beschreibung.

## Nachgewiesene Cache-Regression

Im ersten instrumentierten Docker-/Proxy-Durchlauf am damaligen Head
`7ca49e30a` wurde der CI-Fehler `cache-browser.mjs:25:834` reproduziert:

| Reihenfolge | Command/Owner | PageProps | Runtime-Modell | DOM |
| --- | --- | --- | --- | --- |
| Einreihen während Web-Reentry | Favicon `search.images.set`, alter Images-Snapshot | Images 4 | Images 4 | 4 |
| Cache-Restore abgeschlossen | `xtend.stream.patch` | Web 10 | Web 10 | 10 |
| Bisherige PageProps-/DOM-Barriere | alter Command wird vorbereitet | Web 10 | Web **4** | noch 10 |
| Alter Command committed | Favicon `search.images.set` | Web 10 | Web **4** | **4** |

Der gespeicherte SSR-Cache-Snapshot blieb bei zehn Ergebnissen, die Stream-Anzahl
bei eins (nur Images). Der Aufruf-Stack identifiziert den Favicon-Commit-Callback.
Das ist keine bloße View-Readiness-Lücke: Der alte Payload überschreibt das
Runtime-Modell. Kompakte Originalbeobachtung mit Ergebnis-Fingerprints und
Commit-Zählern: `evidence/mvc/cache-stale-commit.json`.

## Atomarer Modell-Commit

Alle Aufrufer von `search.images.set` tragen jetzt einen Owner aus Suchidentität,
Cache-Epoch/Stream-ID und dem exakten, serialisierten Ergebnis-Snapshot mit.
Die Thumbnail-Anbindung liest dazu das aktuelle Runtime-Modell und erhält
dadurch auch bestehende Favicon-/Feedback-Projektionen.

Beide RMT-Varianten (`standalone.rmt`, `search.rmt`) rufen in dieser Action die
registrierte lokale Maraca App Service `search.images.apply` auf. Sie vergleicht
den Owner **bei Action-Ausführung** mit dem aktuellen read-only Action Model.
Bei einem stale Owner liefert sie die aktuellen Ergebnisse unverändert zurück;
der RMT-Reducer übernimmt ausschließlich dieses Ergebnis. Die frühe
Favicon-Fingerprint-Prüfung dient nur der Vermeidung unnötiger Arbeit. Wird ein
queued CAS abgelehnt, projiziert der coalesced Favicon-Service das aktuelle
Modell erneut statt einen alten Snapshot als letzten Versuch zu behalten.

Die installierte SDK-Version 0.9.0 serialisiert normale Commands und
Stream-Patches über dieselbe `commandQueue`. Der Action-Kontext enthält unter
`stateRuntime` den eingefrorenen `xtend.maraca.action-model-reader.v1`-Port;
der Zugriff ist auf `getState('search.data')` begrenzt. Es wird weder ein
mutabler Runtime-Adapter noch ein zusätzlicher Renderer oder Router verwendet.
Die Prüfung und der RMT-Reduce laufen innerhalb desselben serialisierten
Commands; eine vor dem Enqueue geprüfte Controller-Bedingung wäre unzureichend.

Die vorhandene Cache-Assertion bleibt unverändert. Ein neuer Browsercheck
führt einen gespeicherten Vierer-Images-Command gezielt **nach** Web-Restore aus
und fordert dessen Ablehnung, unveränderte zehn Modell-/DOM-Ergebnisse und
exakt einen bisherigen Stream. Er läuft nach dem vollständigen Cache-Gate in CI:

```sh
TEST_BASE_URL=http://localhost:8093 node xtend/tests/control/cache-stale-projection-browser.mjs
TEST_BASE_URL=http://localhost:8093 TEST_BROWSER=firefox node xtend/tests/control/cache-stale-projection-browser.mjs
```

Fünf gezielte Unit-Regressionen decken queued Reentry, Wachstum innerhalb eines
Streams, andere Ressourcen, fehlende Owner und die Favicon-Neuprojektion nach
einem abgelehnten queued CAS ab. Die finalen tatsächlichen XTend-MCP-Compile- und
Plan-Checks für alle drei RMT-Dateien stehen kompakt mit Input-SHA-256 und
SDK-Vertragsquell-Hashes in `evidence/mvc/xtend-mcp-checks.json`.

## Review-Checkpoint: noch offene Validierung

Am Checkpoint sind Control-Build, 136 Control-Tests inklusive Architektur-Gate,
Docker-v04, Feedback-Readiness, unveränderter Cache-Gate und gezieltes spätes
Images-Replay in Chromium/Firefox bestanden. Die neue PR-CI ist noch offen.
Die lokalen Legacy-Host-Thumbnail-Checks sind ausdrücklich **nicht grün**:
`search.images.set` liefert dort Status `error`, und der Host-Buildreport zeigt
`services.enabled=false`. Diese Service-Anbindung wird noch abgeschlossen;
der Befund wird nicht dem Speicherengpass zugeschrieben.

Der separate Infrastrukturblocker war belegtes `ENOSPC`: Das 32-GiB-Overlay
meldete 31 GiB belegt und null freien Blockspeicher. Nach Entfernung eigener
unbenutzter Diagnose-Images und alten unbenutzten Build-Caches sind 4,8 GiB frei,
die Inodes zu 37 % belegt. Eine read-only Größenmessung zeigt mindestens 25 GiB
unter Docker-`vfs` (einige geschützte Unterverzeichnisse waren nicht lesbar).
`memory.events` meldet `oom=0`, `oom_kill=0`; der Frontend-Container ist nicht
OOM-killed. Die retained vfs-Snapshots der wiederholten Diagnose-Builds sind
damit der belegte dominante Plattenverbrauch. Keine Repository- oder
Testdaten-Volumes wurden gelöscht. Konkrete Zwischenresultate stehen in
`evidence/mvc/cache-fix-tests.json`; offene Checks sind dort als offen markiert.
