# Schließbare Suchhinweise mit XAlert

Suchquellenfehler werden als `x-alert type="warning"`, die Begrenzung auf 100 Treffer als `type="info"` dargestellt. Beide verwenden `closable` und `duration="0"`, kein Overlay und keinen automatischen Timer. Das Schließen betrifft die aktuelle Suchantwort. Auch eine identische erneut abgesendete Suche, Filter-/Seitenwechsel und Back/Forward zeigen die Hinweise der neuen Antwort wieder. Der ausgewiesene Fixture-Testmodus bleibt separat sichtbar; bei komplettem Quellenausfall bleibt die Fehler-/Fallback-Erklärung erhalten.

## Integration

`server/search.mjs` normalisiert Typ, stabile ID und Text. `frontend/search.rmt` projiziert echte `x-alert`-Elemente. Maraca erkennt das Tag und bündelt die Classic-Komponente aus dem gepinnten 0.8.0-Paket automatisch. Kein zusätzlicher Classic-Import, kein zweiter Komponentenloader und kein SDK-Patch für Alerts. Providertexte werden weiterhin als Text gerendert.

`frontend/alerts.mjs` verarbeitet die öffentlichen Ereignisse `alert-shown` und `alert-dismissed`. Die Komponente entfernt beim Schließen ihren Host. Der Adapter gleicht deshalb die gefilterte Warnungsliste über das RMT-Command `search.alerts.set` ab: Sonstige UI-Änderungen können geschlossene Hinweise nicht wieder projizieren. Neue Antworten setzen die Liste ausdrücklich zurück, weil Maracas Page-Client strukturell gleiche Props bei einer identischen erneuten Suche überspringt. Die Page-Props bleiben vollständig. Geschlossene IDs werden nur für die aktuelle Antwort im Speicher gehalten, ohne LocalStorage, Cookie oder Suchprofil.

Classic 0.8.0 fokussiert nach `alert-shown` standardmäßig den inneren Root. Für Inline-Hinweise entfernt der Adapter synchron dessen `tabindex` über den veröffentlichten `root`-Part. Der nicht fokussierbare Root kann den Suchfeld-/Dialogfokus danach nicht stehlen; der native Schließen-Button bleibt tastaturbedienbar. Keine privaten Instanzfelder oder Methoden werden überschrieben. Beim Schließen mit aktivem Fokus folgt der nächste verbliebene Schließen-Button, sonst die Ergebnisüberschrift. Ein inzwischen verschobener Fokus wird nicht zurückgeholt.

Die Darstellung verwendet CSS-Tokens und die in der Paketquelle veröffentlichten Parts `root`/`close`; sie folgt dem System-Hell-/Dunkelmodus. Die MCP-API-Übersicht listet nicht alle Parts, deshalb wurde ebenfalls die Implementierung gelesen.

## Progressive Enhancement

Der Text steht im SSR-Light-DOM. `:not(:defined)` gestaltet die Hinweise vor dem Upgrade und ohne JavaScript; dort gibt es keinen funktionslosen Schließen-Button. Fällt das Maraca-Komponentenmodul aus, bleibt die native GET-Suche nach dem Bootstrap-Fehler verwendbar. Die Schließfunktion benötigt JavaScript.

## Evidenz

MCP-stdio-Aufrufe: `evidence/mcp/alerts-context.json`, `alerts-compile.json`, `alerts-plan.json` sowie `interactions.jsonl`. Compile und Plan melden `ok: true`. Der Browser prüft zusätzlich den tatsächlichen `xtendComponentContract.tag` und das Shadow-DOM.

14 gezielte Chromium-/Firefox-Fälle bestanden (`evidence/tests/alerts/results.json`): Komponentenvertrag, SSR/Upgrade ohne Fokusverlust, Tastatur-Schließen, Fokus-Rückgabe, Persistenz durch Sidebar/Lightbox/Filterentwurf, identische Neusuche, History, Quellenfehler, Themewechsel, 390-Pixel-Ansicht, Modulfehler und no-JS. Die explizite Python-Fixture `media alerts` liefert 101 Bildtreffer zur Begrenzungswarnung; `error` erzeugt einen Fehler der Fixture-Engine. Nur Bildantworten werden durch gekennzeichnete SVG-Testmotive ersetzt. Finale Tests verwenden Container-Assets ohne CSS-Overrides. Mobile Screenshots wurden visuell geprüft; keine manuelle Screenreader- oder echte Mobilgeräte-Abnahme.

17 allgemeine Such-/Resume-/Fallback-/Security-Fälle bestanden (`evidence/tests/alerts/search-regressions.json`), außerdem neun bestehende Adapter-Unitprüfungen (`evidence/tests/alerts-unit.txt`).

Negative Vorläufe bleiben erhalten. Sie deckten einen unnötigen zweiten Classic-Import und den Same-Query-Reset auf. Tests mussten außerdem CSS-Übergänge und den abgeschlossenen Bootstrap-Fehler abwarten. Ein versehentlich gegen den Live-Standardport gestarteter Fixture-Regressionslauf ist als ungültiger Nachweis separat erhalten. Für die Abnahme zählt der vollständige 17-Fälle-Log gegen Port 8090; daraus wurde der Report rekonstruiert, nachdem der falsche Lauf dessen gemeinsamen Standardpfad überschrieben hatte.

Die Skript-Inventur beträgt **439,7 KiB gzip initial**, danach **7,9 KiB gzip** beim ersten Lightbox-Öffnen (`evidence/builds/alerts-script-bytes.json`). XAlert wird vom Maraca-Komponentengraph geladen; kein Versprechen, die Komponente ausschließlich bei sichtbaren Warnungen zu laden. Das 150-KiB-Budget bleibt verfehlt. Kein neuer Timing-/Lastvergleich mit Upstream.

RMT-Quellhash: `d84038395dbd1dd6b432c1a52966a58fd440a2e14c301bc8c83685e6e5777ca5`.

Live-Abnahme auf Port 8080: „Mozilla Firefox“, Bilder, lieferte 100 echte Treffer und zwei Hinweise (Quellenwarnung plus Trefferbegrenzung). Beide ließen sich einzeln per Tastatur schließen; der Fokus ging zunächst zum nächsten Schließen-Button und dann zur Ergebnisüberschrift. Beim Öffnen der Sidebar blieb die Liste leer und das Dokument unverändert. Keine Browser-JavaScriptfehler und keine direkten Fremdorigin-Requests; Readiness HTTP 200. Nachweis: `evidence/tests/alerts/live.json`, `live-dark.png`. Der laufende Container `505b36417769` ist healthy; RMT- und Alert-Adapter-Hashes stimmen mit den lokalen Quellen überein. Die isolierte Fixture-Instanz wurde entfernt.
