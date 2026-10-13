# Wetter und Batch-Meldungen: Verträge 0.6

## Runtime und Navigation

Das gepinnte SDK bleibt XTend 0.9.0, Commit `dd1917bfeb8f…`, mit unverändertem Herkunfts- und SHA-256-Nachweis. PageClient ist der einzige Router und Navigationseigentümer. Maraca Strict Mode erzeugt Such-, Filter-, Auswahl- und Wetterzustände aus RMT. AnimationEngine ist Bestandteil des geprüften Artefakts; ihre Filterübergänge verwenden `interrupt replace` und `reducedMotion instant`. SDK-Quellen werden nicht umgeschrieben.

Die projektbezogene XSearchReportAssistant registriert einen eigenen Component-/RMT-/SSR-Resume-Vertrag und liefert statisches Layout mit Slots über DOM-Elemente. RMT erzeugt alle Felder, ausgewählte Treffer, XButtons und Bestätigungs-XDialog. Es gibt keine HTML-Injektion. Der Host hält nur kurzlebige Transport-/Generationsdaten, ordnet schnelle Interaktionen und bindet bestätigte Navigation an PageClient. Cache-Snapshots enthalten keine Report-Auswahl oder Dialogentwürfe.

## App Services

| Vertrag | Transport / Grenze |
| --- | --- |
| `search.weather.run` | Serverstream, POST/NDJSON innerhalb Maraca; überprüfte Weather-GET-Identität, Frames für Ort, Lage, Prognose und Warnungen; genau ein terminaler Summary-Frame. |
| `search.weather.cache.context` | Öffentliche Query ohne Ortsdaten und Provider-Dispatch; Policy-/Instanzepoche und Warnstandversion. |
| `search.cache.capture/restore/invalidate` | Vorhandene lokale App Services über den Framework-RAM-Cache; Wetter-TTL und Warnfrische ergänzen dessen Policy. |
| `search.feedback.batch.submit` | Öffentlicher Command mit gebundenem CSRF-Kontext; 1–5 Nachweise, Grund, boolesche Linkzustimmung und Idempotenzschlüssel. Keine frei vertrauenswürdigen Engine-/URL-Angaben. |
| `GET/POST /feedback/batch` | Signierte Nachweise prüfen; GET liefert CSRF und verifizierte Linkvorschau oder natives Formular. POST nimmt denselben Batch atomar an. |
| `admin.weather.policy.set` | Administrator, CSRF, Revision, Idempotenz und Audit; Freigabe/Pause/Warnungen und konservativ gedeckelte Budgets. |

Native Suche, Deep Links, Geocoding und Forecast verwenden HTTP-GET. Providerantworten sind vollständige JSON-Dokumente. XScaler streamt die normalisierten Abschnitte; es wird kein Providerstreaming behauptet. Aktuelle Lage/Prognose laufen parallel, Warnungen unabhängig. Der bestehende Presentation Coordinator verwirft alte Generationen und beendet Busy auch bei Teilfehler, Abbruch, Servicefehler oder Restore.

Ein verborgenes `location_q`-Feld im nativen Formular erkennt eine geänderte Eingabe auch ohne JavaScript. Es ist kein Cache-/Session-Schlüssel und wird aus der kanonischen URL entfernt. Bei geänderter Eingabe wird die zuvor gewählte Orts-ID verworfen.

## Atomare Batch-Annahme

Alle Nachweise werden vor der Speicherung auf Integrität, Ablauf, Katalogstand und echte beteiligte Capabilities geprüft. Ein Fehler verhindert die gesamte Annahme. SQLite speichert Batch-Digest, verwendete Nachweise, deduplizierte Engine/Capability-Stimmen und Belegzuordnungen in einer Transaktion. Belegdateien werden getrennt verschlüsselt angelegt; beim Transaktionsfehler werden neue Dateien entfernt. Wiederholung des gleichen Batches bestätigt die vorhandene Annahme. Andere Batches mit bereits verwendeten Nachweisen werden abgelehnt.

RAM-Limits gelten pro ausgewähltem Ergebnis (fünf/Minute, 20/Tag je Browser, zusätzliche Netz-/Globalgrenzen). Die Qualitätsfenster und Vorschläge erhalten höchstens eine Stimme je Scope und Batch. Browserkontexte belegen keine unabhängigen Personen. Kein Suchtext, Titel, Snippet oder Freitext wird gespeichert. URLs nur nach Zustimmung und ausschließlich im separaten Belegspeicher; Operator-/Administratorzugriff und bisherige Rotation bleiben erhalten.

## Wetter und DWD

Begrenzte SDK-RAM-Caches teilen Geocoding und Forecast-Abrufe ohne Nutzeridentität. Ein Permit wird beim Freigeben direkt an einen wartenden Abruf übertragen, damit auch bei gleichzeitig eintreffenden Aufrufen die Zweiergrenze eingehalten wird. Ein einzelner abgebrochener Konsument beendet keinen gemeinsam genutzten Abruf; ohne Konsumenten wird er abgebrochen.

Budgetzähler sind Minutensummen, deren Reservierung vor dem Upstream-GET atomar gegen Minuten-/Stunden-/UTC-Tages-/Monatsgrenzen geprüft wird. Überlappende Randminuten werden konservativ vollständig gezählt. Aktuelle Daten kosten eine und das kombinierte Forecast-Paket vorsorglich zwei Einheiten. Kein Retry; 429 respektiert eine begrenzte Schutzfrist. Neustarts löschen nur RAM-Caches, nicht Quota.

CAP-Archive werden nur im RAM gelesen, nie extrahiert. Central Directory, Pfade, Links, Methoden, CRC, Größen und Dateianzahl werden geprüft; ZIP64 und Verschlüsselung sind nicht erlaubt. XML wird validiert; DOCTYPE/externe Entitäten sind ausgeschlossen. Standard-XML-Escapes werden dekodiert und Warntexte anschließend als RMT-Text gerendert. Update/Cancel-Referenzen entfernen alte Warnungen; Ablauf wird auch zwischen Refreshes geprüft.

CAP-Polygone nutzen [Länge, Breite] mit Ausschlussringen. Bei fehlenden Polygonen werden amtliche Warngebiets-IDs in exakt konvertierten, gepinnten WGS84-Geometrien nachgeschlagen. Keine Vereinfachung der Ringe; Löcher werden über geometrische Verschachtelung bestimmt. Produktfrische nutzt den HTTP-Last-Modified-Stand, nicht das möglicherweise viel ältere Ausgabedatum einer einzelnen noch gültigen Warnung. Ohne Produktmetadaten bleibt der konservative CAP-Zeitfallback. Unbekannte Geometrien verhindern eine Aussage „keine Warnungen“.

## Datenschutz / ADR-Ergänzung

Die bestehende begrenzte Ausnahme für freiwillige Ergebnisbelege bleibt bestehen; Batch-Annahme erweitert nur deren Zuordnung. Ortsbegriffe und Koordinaten befinden sich ausschließlich in kurzlebigen, gemeinsam verwendeten RAM-Ressourcen und im notwendigen Provider-GET. Wetter schreibt keine Suchsession und keine Ortsdaten in Audit, Ereignisse oder Budgettabellen. Der Browsercache bleibt tabbezogen, flüchtig und bounded. About nennt Open-Meteo/GeoNames/DWD, Providerübermittlung und eigene Providerprotokollierung.
