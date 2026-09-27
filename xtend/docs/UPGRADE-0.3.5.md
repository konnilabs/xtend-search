# XTend.search 0.3.5 — Webquellen und Herkunft der Treffer

## Befund

Die exakte Anfrage `GNU/ Linux`, Sprache Englisch, SafeSearch aus und ohne
Zeitraumfilter lieferte lokal unter 0.3.4 sowohl direkt als auch mit XScaler
42 Ergebnisse aus Bing, Brave und Google CSE. Der Sprachfehler aus 0.3.4 war
hier nicht erneut reproduzierbar. Eine öffentliche Abfrage der Produktionsseite
lieferte dagegen 20 Google-CSE-Treffer, „3 von 3 Quellen abgeschlossen“ und
einen allgemeinen Quellenfehler. Aus dieser öffentlichen Antwort allein ist
nicht erkennbar, welche andere Quelle weshalb ausfällt. Der vom Betreiber
mitgeteilte Wikidata-Roundtrip `empty`, `errorClass: null` bezeichnet eine
Antwort ohne Treffer und keinen Transportfehler.

Die Prüfung deckte jedoch drei konkrete Fehler auf:

1. Wikipedia und Wikidata erben von SearXNG die Kategorie `general`, liefern
   im geprüften Backendprofil vorrangig Infoboxen. Sie konnten reguläre Plätze
   im auf drei Quellen begrenzten Webpool belegen. 0.3.5 hält diese bekannten
   Wissensquellen aus dem Webpool heraus und verwendet sie ausschließlich im
   separaten `knowledge`-Pfad. Dafür ist weiterhin die ausdrückliche
   `knowledge`-Freigabe erforderlich. Bis zu drei normale Webquellen plus eine
   Wissensquelle bleiben möglich; Gesamtbudgets und Schutzfristen gelten weiter.
2. Beim Entfernen gleicher URLs gingen die zusätzlichen Quellen verloren.
   0.3.5 ergänzt alle tatsächlichen Quellen am vorhandenen Treffer. ID, Position,
   Titel und Inhalt bleiben stabil; XScaler aktualisiert die Herkunft ohne
   Dokumentneuladung. Dies gilt auch bei gleichem Bild und gleicher Zielseite.
3. „Abgeschlossen“ unterschied nicht zwischen verwertbaren Ergebnissen, Fehlern
   und nicht ausgeführten Quellen. Die fertige Übersicht zählt nun Quellen mit
   Treffern, fehlgeschlagene und nicht ausgeführte Quellen getrennt. Im
   aufklappbaren Hinweisbereich stehen Quellennamen und verständliche Gründe,
   einschließlich fehlender Filterabdeckung, ausstehender Freigabebestätigung,
   Budgets und Schutzfristen. Nicht freigegebene Quellen werden nicht aufgezählt.

Nur fest vorgegebene Fehlermeldungen gelangen in die Oberfläche, keine rohen
Providerantworten, internen Budgetwerte, Zugangsdaten oder URLs aus Exceptions.
Der Hinweisbereich passt sich auf kleinen Displays an mehrzeilige Texte an.

## Update in Portainer

Frontend `xtend-search:0.3.5`, Backend unverändert
`xtend-search-searxng:0.3.0`. Das Archiv enthält nur das Frontend.

```bash
docker load -i XTend-search-Docker-Image-0.3.5-linux-amd64.tar.gz
```

Im bestehenden Stack `XTEND_SEARCH_IMAGE=xtend-search:0.3.5` setzen und den Stack
aktualisieren; alle übrigen Variablen und Volumes erhalten. Lokal importierte
Images nicht erneut aus einer Registry ziehen. `/health/ready` und der
HTTP-Header `X-XTend-Version` müssen danach 0.3.5 anzeigen.

0.3.5 ändert keine Katalog-Fingerprints und erfordert keine erneute allgemeine
Policy-Migration. Eine noch nicht durchgeführte Bestätigung des erweiterten
Sprachkatalogs aus 0.3.4 bleibt erforderlich; 0.3.5 umgeht diesen Schutz nicht.

**Wikipedia und Wikidata:** Im Observatory „knowledge“ als freigegebene
Capability eintragen, falls Wissenskarten gewünscht sind. „general“ allein
schaltet diese Quellen nicht mehr als normale Webquellen ein. Vorhandene
SafeSearch-Ausnahmen, Budgets und Freigaben werden nicht automatisch geändert.
Die Admin-Oberfläche erklärt dies direkt an der jeweiligen Quelle.

**Bei weiterhin nur einer Quelle in Produktion:** Den Quellenhinweis oberhalb
der Treffer öffnen und den benannten Grund im Observatory prüfen. Eine leere
Antwort ist kein Ausfall. Ein CAPTCHA, ein abgewiesener Zugriff oder eine
Schutzfrist wird durch diesen Patch nicht aufgehoben. Aus „drei geplant“ folgt
nicht, dass drei Anbieter erfolgreich antworten können. Weitere Suchquellen
nur nach eigener Prüfung ausdrücklich freigeben.

Rollback: Frontend auf 0.3.4 zurückstellen und Volumes beibehalten. Es gibt keine
Schema- oder Policyänderung; lediglich die oben beschriebenen Fehler kehren zurück.

## Engineering-Nachweise

Regressionstests prüfen getrennte Web-/Wissensplanung mit tatsächlicher
`knowledge`-Freigabe, Zusammenführung gleicher Treffer über mehrere Frames,
stabile Zeilen, partiellen Erfolg, leere Antworten, Budgets und Quellenfehler.
Browsertests prüfen echte RMT-/XScaler-Aktualisierung, SSR/no-JS und mobile
Hinweise. Die Such-RMT und die Framework-Komponenten bleiben unverändert;
der Maraca-Build enthält die korrigierten Services und Styles.

Nachweise: `xtend/evidence/control-plane/release-0.3.5-*`.
