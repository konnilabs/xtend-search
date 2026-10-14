# v04: Feedback-Bereitschaft vor dem Speichern

Baseline: Main `a1914801c798e04ffb4f8a1e62da60de70cda23b`.
Der Anwendungscode, SDK und RMT bleiben unverändert.

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
