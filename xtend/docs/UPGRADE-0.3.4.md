# XTend.search 0.3.4 — Sprachabdeckung der Bildquellen

## Befund und Korrektur

Lokal reproduziert mit `open source`, SafeSearch 1 und ohne Zeitraumfilter:
„Alle Sprachen“ lieferte 53 Bilder aus Bing und Google CSE, „Deutsch“ nur
20 Bilder aus Google CSE. Die deutsche Auswahl schloss Bing vor dem Dispatch
irrtümlich aus. Streaming und SSR zeigten dasselbe Verhalten.

SearXNG erklärt eine Quelle als sprachfähig, wenn sie Sprach- **oder**
Regionszuordnungen besitzt (`searx/enginelib/traits.py`). Bing Images verwendet
`traits.get_region()` und daraus `setlang`/`cc`. Der private `/config`-Endpunkt
liefert bereits beide Listen; der XTend-Adapter las bislang nur `languages`.
0.3.4 berücksichtigt zusätzlich die tatsächlich gemeldeten Regionskennungen
(z. B. `de-DE`, `en-US`). Ein leerer Katalog bedeutet weiterhin keine bestätigte
Sprachabdeckung. Der gewählte Filter wird unverändert an SearXNG übermittelt.

Das betrifft auch andere regionale Quellen und Suchmodi. Es gibt kein neues
Backend-Image, keinen neuen Suchalgorithmus und keine Erhöhung der Limits.
Die lokale DuckDuckGo-Anbietergruppe ist weiterhin durch eine bestehende
CAPTCHA-Schutzfrist gesperrt; dies ist unabhängig vom behobenen Sprachfehler.

## Update und bestehende Quellenfreigaben

Frontend: `xtend-search:0.3.4`, Backend unverändert `xtend-search-searxng:0.3.0`.
Das Docker-Archiv lässt sich direkt laden:

```bash
docker load -i XTend-search-Docker-Image-0.3.4-linux-amd64.tar.gz
```

Im bestehenden Portainer-Stack nur `XTEND_SEARCH_IMAGE=xtend-search:0.3.4`
ändern und aktualisieren. Bestehende Variablen, Schlüssel und Volumes erhalten;
kein Pull aus einer Registry. `/health/ready` muss anschließend 0.3.4 melden.

**Einmalige Prüfung nach dem Update:** Bei Quellen, deren erfasste
Sprachabdeckung erweitert wurde, ändert sich der Capability-Fingerprint.
Die Control Plane verlangt daher eine erneute Bestätigung. Im Observatory
unter „Quellen“ die bereits freigegebenen betroffenen Quellen auswählen,
die bisherigen Freigaben und Budgets prüfen und die Policy erneut speichern.
Die vorhandenen Werte müssen dafür nicht erhöht werden. Neue oder zuvor
abgeschaltete Quellen bleiben gesperrt. Schutzfristen werden durch erneutes
Speichern nicht aufgehoben.

Für eine kontrollierte Wartung gibt es alternativ
`xtend/scripts/repair-locale-catalog.mjs`. Der Standardaufruf zeigt ausschließlich
einen Vorschlag an. Das Werkzeug übernimmt nur bestehende Freigaben, deren
bisheriger Fingerprint exakt zum unveränderten übrigen Backend-Katalog passt;
weitere Capability-Änderungen verweigert es. Es wird **nicht automatisch** beim
Start ausgeführt. Für `--apply --revision=<geprüfte Revision>` müssen die Suche
gestoppt und der exklusive `owner.lock` gehalten sein. Vor dem Schreiben wird
ein SQLite-Backup angelegt; Änderungen erfolgen über denselben validierten,
revisionsgebundenen und protokollierten Policy-Pfad wie in der Admin-Oberfläche.
Budgets, Schutzfristen, Kategorien, SafeSearch-Ausnahmen und gesperrte Quellen
werden nicht geändert. Die lokale Reparatur ist unter dem Akteur
`maintenance:locale-catalog-repair` im Änderungsprotokoll erkennbar.

## Nachweis und Rollback

Die Regressionstests decken echte Bing-Traitdaten, Sprach-/Regionszuordnung,
unbekannte Sprachen, Fingerprint-Prüfung, unveränderte Budgets und Sperren sowie
zwei gestreamte Bildquellen bei deutscher Suche ab. Die bisherigen Tests laufen
weiter. In einem bestehenden Test wurde die Testdatum-Zeitzuordnung stabilisiert,
damit ein Millisekundenwechsel zwischen Beobachtung und Telemetrie nicht den
beabsichtigten Reparaturfall verändert; die Produktionsprüfung bleibt strikt.

Es wurden keine XTend-Komponenten, RMT-Verträge oder XScaler-Protokolle geändert;
der Fix liegt ausschließlich im SearXNG-Adapter und der Sprachenprüfung.
Nachweise: `xtend/evidence/control-plane/release-0.3.4-*` und `images-*-before.json`.

Für Rollback das Frontend auf 0.3.3 zurückstellen. Unter 0.3.4 neu bestätigte
Quellen benötigen dann gegebenenfalls erneut eine Policy-Bestätigung, weil
0.3.3 den alten Sprachkatalog verwendet. Die fehlende regionale Spracherkennung
kehrt dabei zurück. Niemals zum Rollback Sperren oder Budgetdaten löschen.
