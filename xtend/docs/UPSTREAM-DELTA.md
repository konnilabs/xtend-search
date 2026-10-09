# Upstream-Delta

Basis: `e831fc2a1cad50c9979b5f6f680376410218188c` vom 19.09.2026.

Aktuelle Update-Bewertung und reproduzierbare Gates: [SearXNG-Upstream-Prüfung vom 09.10.2026](SEARXNG-UPSTREAM-REVIEW-2026-10-09.md). Der konkrete Pin und die geprüfte Integrationsboundary stehen in `xtend/upstream-searxng.json`.

| Bereich | Änderung |
| --- | --- |
| `searx/webapp.py` | Optionale private JSON-Metadaten und Auswahl des privaten Streamingadapters; Standardschnittstelle bleibt gleich. |
| `searx/xtend_integration.py` | Ergänzt Vertrag, effektive Filter, Paging und vorhandenen Bildproxy. |
| `searx/xtend_stream.py` | Kopiert nach Engine-Batches vorläufige Ergebnisse in eine begrenzte Snapshot-Queue. Der normale Suchlauf liefert den endgültigen Stand. Node überträgt diese Daten mit dem echten XTend-AppService-Host an den XScaler-Adapter. |
| `searx/engines/xtend_fixture*.py` | Explizit aktivierbare lokale Testengines, einschließlich verzögerter Streamingquelle; im Live-Profil nicht registriert. |
| Templates/Infopages | XTend.search-Wortmarke, eigene Logos, deutsche/englische Attribution und Privacy-Hinweise. |
| Theme-Assets | Eigenes SVG-/PNG-Branding auch für Fallback und Manifest-Icons. Historische Dateinamen enthalten teilweise weiterhin `searxng`, deren Inhalte wurden ersetzt. |
| `.dockerignore`, `.gitignore` | Integration und lokale Secrets/Builds berücksichtigen. |
| `xtend/`, `Dockerfile.xtend`, `compose.xtend.yml` | Neue, abgegrenzte Frontend-/Build-/Runtime-Integration. |

Bestehende Engineimplementierungen, Requestparser, Plugins, Rankingfunktionen, ResultContainer und Python-Requirements von Upstream wurden nicht verändert. Der Streamingadapter erweitert den ResultContainer für Zwischenstände; die finale Suche verwendet weiter die normale Abschlusslogik. Der separate ursprüngliche Vergleichscheckout erhält ausschließlich dieselbe zusätzliche Fixture-Engine als Messinstrument. Seine Templates, JS und CSS bleiben original; die identische Fixture-Konfiguration setzt allerdings denselben Instanznamen. Die Streamingtests sind eine eigene Messreihe und ersetzen diesen ursprünglichen Vergleich nicht.

Bei einem Update: Upstream neu pinnen, Core-Vertrag und JSON-Serializer kontrollieren, Brandingdiff prüfen, App und unveränderte Baseline neu messen. XTend-Snapshot erst separat aktualisieren und kompilieren; niemals ein neues Runtime-Paket unter einen alten Page-/Resume-Build schieben.
