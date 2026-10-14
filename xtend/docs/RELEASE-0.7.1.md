# XTend.search 0.7.1 — Native Komponentenhüllen und HTML-Prüfung

Dieser Patch baut auf dem noch offenen Release-PR [#19](https://github.com/konnilabs/xtend-search/pull/19) für 0.7.0 auf. Er übernimmt den exakt gepinnten Head des Framework-PR [#112](https://github.com/konnilabs/xtend/pull/112); Paketdatei, Commit und SHA-256 stehen in `xtend/vendor-inputs/xtend-0.9.0-provenance.json`. Das Framework wird dadurch weder gemergt noch veröffentlicht.

Die geladenen Komponenten XIcon, XButton, XSpinner, XToggle, XSection, XToast, XDialog und XAlert bauen ihre internen Hüllen mit DOM-APIs. SVG-/URL-Icons verwenden validierte Geometrie beziehungsweise native Bildelemente. Dialogtitel bleiben Text. Öffentliche Slots, Parts, Events und RMT-Verträge bleiben erhalten. Der bereits gemergte native Toggle-Fix ist ebenfalls enthalten; der Search-Workaround entfällt.

Beide Search-Buildpfade aktivieren den optionalen Maraca-`htmlSecurity`-Gate für alle eigenen Frontend-/Admin-Quellen. Die Syntaxprüfung erkennt direkte und konstant berechnete HTML-Sinks, zusammengesetzte Zuweisungen und einfache lokale Methoden-Aliase. Sie ersetzt weder CSP und Sanitizer noch Laufzeit-Ownership. Der vorhandene `trusted_html`-/Trusted-DOM-Ausnahmeweg bleibt erhalten; eine ungeprüfte Bypass-API wird nicht eingeführt. SSR-/Recovery-Parser und Sanitizer werden nicht pauschal entfernt.

Das Frontend wird als **0.7.1** gebaut; das SearXNG-Backend bleibt **0.5.1**. SSO, Freigaben, Schutzfristen, Wetterkonfiguration und Datenvolumes bleiben erhalten. Vor einem Upgrade Volumes und geschützte Env-Konfiguration sichern. Danach nur den Suchcontainer neu erstellen und die Browser-Tabs neu laden. Merge, Publishing und Produktionsdeployment bleiben getrennte Schritte.

Docker/Portainer: `XTEND_SEARCH_IMAGE=xtend-search:0.7.1`, `XTEND_BACKEND_IMAGE=xtend-search-searxng:0.5.1`. Bei lokal geladenen Images keinen Registry-Pull erzwingen. Vor dem Laden `SHA256SUMS` prüfen. Ein Rollback nutzt den vorherigen Frontend-Stand 0.7.0 und unverändert Backend 0.5.1; es gibt keine Speichermigration.

## Prüfung

139 Control- und 10 Anwendungstests, beide Strict-Maraca-Buildpfade mit 36 geprüften Browserquellen, neun Browser-Gates sowie fünf Wiederholungen gegen das endgültige Image sind bestanden. About, Melde-Assistent, Streams, Cache, No-JS-Wetter und native Temperaturumschaltung wurden geprüft. Such-/Wetter-Fixtures zeigen CLS 0; der Toggle-Kontrast liegt mindestens bei 7,57:1. Portainer startet mit separaten Testvolumes erfolgreich. Der Framework-Nachweis umfasst 189 Suite-IDs über vollständigen Lauf und gezielte Wiederholungen, 38 native DOM-Browserfälle und 24 Syntax-/Build-Fälle. Details und Grenzen stehen in `0.7.1-verification.json`.
