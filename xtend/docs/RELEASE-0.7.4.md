# XTend.search 0.7.4 — Lesbare Fehler- und Leerzustände

In 0.7.3 konnten normale leere oder fehlgeschlagene Suchen `$model.search.data.emptyTitle` und `$model.search.data.emptyMessage` sichtbar ausgeben. Die Anwendung war dabei nicht durch eine JavaScript-Ausnahme abgestürzt.

## Ursache und reproduzierbarer Aufrufpfad

`SearchExecutor.run()` → `snapshot()` → `normalizeResults()` → `baseData()` lieferte für normale Suchen keine optionalen Wetter-Overrides `emptyTitle` und `emptyMessage`. Das RMT-Template verwendete diese Kurzreferenzen als Test und Ergebnis eines `if`-Ausdrucks. `projectPortableRender()` delegiert die Auflösung an `rmt-dom-descriptor-renderer.resolveValue()`. Das gepinnte SDK liefert bei nicht aufgelösten String-Referenzen den ursprünglichen String zurück. Dieser ist wahrheitswertig: Die Bedingung nimmt den Override-Zweig und der Pfadtext erscheint als Überschrift beziehungsweise Beschreibung. Derselbe Resolver wird auch bei Client-Updates verwendet.

Die direkten Regressionstests schlugen vor dem Patch sowohl für fehlgeschlagene als auch für leere Suchantworten fehl. Es handelt sich um einen deterministischen Darstellungsfehler in diesen Zuständen; sporadisch ist vor allem deren Auftreten bei fehlschlagenden Providern. Im gemeldeten lokalen Zustand waren zusätzlich drei Provider-Timeouts vorhanden. Dieser Patch ändert keine Providerfreigaben oder Schutzfristen.

## Korrektur

- `baseData()` deklariert beide optionalen Texte mit leerem Default.
- Die vier RMT-Textbindungen nutzen explizite `path`- und `fallback`-Ausdrücke. Fehlende, `null`- und leere Overrides wählen so auch mit dem vorhandenen SDK die vorgesehenen Texte. Ein fehlendes Fehlerdetail erhält einen lesbaren Standard.
- Spezifische Wettertexte bleiben erhalten. SSR, No-JS, Streaming und Cache-Wiederherstellung verwenden dieselbe deklarative Darstellung. Keine DOM-Injektion, kein SDK-Patch und keine zusätzliche Renderlogik im Host.
- Die allgemeine Behandlung fehlender expliziter Referenzen wird separat im Framework geprüft und als eigener [Upstream-Patch #114](https://github.com/konnilabs/xtend/pull/114) eingereicht. Search behält seinen bestehenden SDK-Pin und das Backend 0.5.1.

Der Browser-Regressionstest umfasst leere Web-/Bildsuche, Cache-Back, SSR und No-JS, Erholung zu erfolgreichen Ergebnissen und tatsächliche Fehler der lokalen Offline-Provider. Die Fehlerszenarien laufen am Ende der CI-Browser-Gates, damit deren technische Sperren keine nachfolgenden Erfolgsfixtures beeinflussen.

## Upgrade

Nur das Frontend auf `xtend-search:0.7.4` aktualisieren; `xtend-search-searxng:0.5.1` bleibt unverändert. Vorher Datenvolumes und geschützte Env-Datei sichern. Es gibt keine Speichermigration oder Änderung an Freigaben und SSO. Browser-Tabs nach dem Update neu laden. Rollback: vorheriges Frontend 0.7.3. GitHub-Merge und Produktionsdeployment bleiben separate Schritte.
