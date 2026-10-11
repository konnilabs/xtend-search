# ADR-XSEARCH-005: Ressourcenwiederverwendung und kontrollierter Wiederanlauf

Status: implementiert als reviewbarer Release-Kandidat 0.5.0. Framework-Abhängigkeit: PR konnilabs/xtend#110, exakt gepinntes SDK-Artefakt und Lockfile. Auslieferung und Rückweg: [RELEASE-0.5.0.md](RELEASE-0.5.0.md).

## Entscheidung

Speicher und Navigations-Lifecycle gehören ins Framework. Search kapselt Identität, Epoche, Tokenfristen und Wiederverwendungsentscheidung in lokalen Maraca App Services. Ein Treffer wird als JSON-Ressource mit bestehenden Seitenartefakten projiziert; kein zweiter Router, DOM-Snapshot oder erneutes Resumieren gecachter SSR-Daten. Eine kleine Metadatenprüfung prüft Änderungen vor jedem lokalen Treffer. Explizite Suche bleibt frisch. History speichert keine Ergebnisse.

Der Cache ist tablokal, begrenzt und vergänglich. Serverseitige Suchsessions würden zusätzliche Datenschutz- und Betriebsanforderungen erzeugen; dauerhafter Browser-Speicher würde Suchhistorie über den Tab hinaus halten. Beides wird nicht eingeführt. Der bisherige freiwillige Cookie für Filter bleibt unabhängig.

Knowledge ist ein separater semantischer Suchpfad. Providerfamilien, Sprachabdeckung und Filterausnahmen bleiben Search-Politik. Ein zusätzlicher geprüfter DDG-Adapter und höchstens ein Fallback diversifizieren die Card ohne unbegrenzten Fan-out. Ein RAM-Rotationszähler enthält keine Suchbegriffe. Neue Capabilities erfordern Adminfreigabe.

Native SearXNG-Fristen werden über einen authentifizierten Metadatenvertrag gelesen, nicht erraten. Persistierte Schutzfristen werden nicht pauschal verkürzt. Nach Ablauf aller Guards reserviert die nächste reale Suche genau einen technischen Wiederanlauf; die Lease wird vor Dispatch atomar gespeichert und schließt auch native gemeinsame Sperrbereiche ein. Hintergrund-Probes bleiben optional und standardmäßig aus. Technische Erreichbarkeit, administrative Freigabe und aktuelle Verfügbarkeit werden getrennt angezeigt.

## Daten- und Upgrade-Grenzen

Kein neues Ergebnisdatenvolume, keine serverseitigen Ergebnis-Sessions. Bestehende Policy-Tabellen und Qualitäts-Beleggrenzen bleiben. Recovery ergänzt persistierte Guards additiv um Scope, Fristursprung und Lease. Für ältere Versionen wird ausschließlich die vorherige gesicherte Datenbank zurückgespielt. Neue Capability-Fingerprints werden nicht automatisch genehmigt.

Der offizielle Framework-Initial-Resume-Vertrag ersetzt die alte SSR-Überlagerung. Dogfooding zeigte, dass dessen Node-Ausgabe bei aktivierter Kompaktierung noch keine Referenztabelle nutzte. Der Framework-PR ergänzt diese allgemeine Transportprojektion, mit unverändertem signiertem State und streng getrennter Initial-Dokument-Grenze. Ordinary PageResponse- und Autorisierungsprüfungen bleiben erhalten.

## Nachweise

Framework-Gates, reproduzierbare Offline-Provider, No-JS- und Browser-Gates sowie Performance gegen 0.4.4 werden im Verification-Archiv dokumentiert. Ein callable XTend-MCP wurde nicht exponiert; sämtliche Entwicklungsnachweise sind korrekt als SDK/CLI/Browser ausgewiesen. Vollständige Abnahme und konkrete Messwerte sind erforderlich, bevor der Release-Kandidat gemergt oder produktiv ausgerollt wird.
