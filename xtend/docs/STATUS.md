# Übergabestatus

**Funktionaler MVP implementiert und lokal als Docker-Container mit Live-Suche geprüft.** Eigene Wortmarke/Icons und Attribution auf `/info/de/about` umgesetzt.

Wissenskarten und die interaktive Bildvorschau wurden als Erweiterung ergänzt; Details und Nachweise stehen in `MEDIA-SURFACES.md`. Das optionale Vollbild-Carousel verwendet die klassische XTend-XLightbox; Integrationsvertrag und projektlokaler Slot-Patch sind in `LIGHTBOX.md` dokumentiert.

Schließbare Suchhinweise nutzen XTend-XAlert; Integration und aktuelle Nachweise stehen in `ALERTS.md`.

Nicht erreichbare Trefferbilder erhalten lokale Platzhalter. Vorschaufehler sind einzelnen Anforderungen zugeordnet; Verhalten und Grenzen: `IMAGE-FALLBACK.md`.

**0.2.0 ergänzt Ergebnisstreaming mit dem echten XTend-XScaler-Transport.** Ein privater Pythonadapter liefert vorläufige Engine-Batches an den Node-AppService-Host; nachfolgende SPA-Suchen übernehmen sie durch Maraca. Initial-SSR und no-JS bleiben vollständig. Architektur, Lifecycle, Abnahme und lokaler Rollback stehen in `XSCALER-STREAMING.md`.

**0.2.1 erhöht die mobile Suchfeldschrift von 14 auf 16 px.** Die einheitliche Basisschrift gilt auf Start- und Ergebnisseite sowie nach resumierbarer Navigation und ohne JavaScript. Die Viewport-Konfiguration bleibt unverändert.

**Performancefreigabe offen.** Das 150-KiB-JavaScript-Budget und das SSR-/TTFB-Mehrkosten-Ziel werden verfehlt. Dies ist ein negatives, dokumentiertes Ergebnis der 0.8.0/Hydrangea-Leistungsprüfung, keine noch zu versteckende Messlücke. Die ausführliche Abnahme steht in `VERIFICATION.md`.

Nächste sinnvolle Entwicklungsschritte:

1. RMT-/Maraca-Basisgraph verkleinern; vor Streaming initial 441,2 KiB gzip (plus 8,0 KiB bei erstmaligem Öffnen). Aktuelle Streaming-Inventur siehe `XSCALER-STREAMING.md`. Kein zusätzlicher UI-Framework-Layer.
2. SSR-Projektion und Dokument-/Seed-Größe optimieren, Durchsatz gegen dieselben Fixtures nachmessen.
3. Zusätzliche Kategorien/Sprachen und weitere Spezial-Ergebniskarten modellieren; Classic bleibt der vollständige Upstream-Pfad.
4. Für öffentlichen Betrieb konkrete TLS-/Auth-/Limiter-Konfiguration abnehmen; Langzeit- und Screenreaderprüfungen ergänzen.
5. Streaming unter längerfristiger Last und hinter dem konkreten Server-Reverse-Proxy messen; die lokalen Nachweise ersetzen keine Produktionsmessreihe.

Der lokale XTend-Checkout enthält vorhandene Nutzeränderungen und wurde nicht verändert. Für Reproduktion das mitgelieferte gepinnte Paket verwenden; ein neuer Snapshot benötigt erneute MCP-Compile-/Plan-, Bundle-, Resume- und Browserprüfungen.
