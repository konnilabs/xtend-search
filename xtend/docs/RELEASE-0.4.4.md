# XTend.search 0.4.4 – eine Wortmarke, zwei Positionen

9. Oktober 2026. Frontend **0.4.4**, erweitertes SearXNG-Backend **0.4.2**, XTend **0.8.0 / Hydrangea**.

Auf der Startseite steht ausschließlich die große, zentrale Wortmarke. Das kleine Branding oben links entfällt. Tagline, zentrierte Suche, CCS-Farben, About-Icon und Footer bleiben erhalten. Die Shell füllt weiterhin den Viewport.

Beim Suchstart bewegt sich dieselbe Wortmarke nach oben links und verkleinert sich auf die Headergröße. Logo und Headerhintergrund blenden mit denselben 320ms-Keyframes ein. Das bestehende Morphing der Suchleiste läuft parallel. Zurück/Vorwärts stellt die jeweilige Position wieder her; Stream-Batches und Filterwechsel starten keine weitere Animation.

## Umsetzung und XTend-Vertrag

Ein keyed Link mit einer keyed Textfläche ersetzt die zwei bisherigen Wortmarken. Die zentrale Textfläche ist auf der Startseite eine Überschrift der Ebene 1; in der Ergebnisansicht übernimmt die Ergebnisüberschrift diese Rolle. Das dekorative Logo bleibt im DOM und ist auf der Startseite ausgeblendet. Keine Kopie, kein Reparenting und kein zusätzlicher Router.

Die bereits integrierte öffentliche API `XUtils.runUiTransition` erhält gemessene Transform-Keyframes und getrennte `layoutKey`-Werte für Formular und Wortmarke. Nur die Textfläche wird bewegt, während das Logo separat einblendet. PageClient verantwortet weiterhin Navigation und Commits. Vor der Messung einer neuen Navigation werden laufende eigene Effekte entfernt, sodass deren transformierte Zwischenposition nicht als Ausgangsgeometrie verwendet wird.

SSR und der öffentliche XSection-Part `content` verwenden dasselbe Grid. Ohne JavaScript bleibt die Wortmarke auf der Startseite zentriert und bei Ergebnissen im Header. Reduced Motion oder fehlende Web-Animations-Unterstützung verwenden unmittelbar das fertige Layout. Die Animation blockiert keine Ergebnisse. Der lokale SDK-Vertrag wurde im Quellcode geprüft; aufrufbare XTend-MCP-Tools standen nicht zur Verfügung. Keine Frameworkänderung und keine neue Abhängigkeit.

## Abnahme

Das erweiterte `home-browser.mjs` prüft eine einzige zentrierte Wortmarke, unsichtbares Logo auf der Startseite, Überschriftsemantik, identische DOM-Elemente, echtes XUtils-Morphing, gemeinsame Fade-Keyframes, Back/Forward und Effektbereinigung. Light/Dark, 320–3840px, volle Viewporthöhe, Reduced Motion, fehlende Animation-API und native Suche ohne JavaScript sind Teil dieses Gates. Bestehende Qualitäts-, Filter-, SSR-/Resume-, About-, Bild-/Streaming- und Observatory-Gates bleiben aktiv; SSO wird mit der bestehenden OAuth-Fixture geprüft.

Release-Nachweise und Bundle-/Wire-Größen: `xtend/evidence/control-plane/0.4.4-*` sowie `release-0.4.4-export.json`. Das Backend bleibt bei 0.4.2; bestehende Freigaben, Regeln, Pausen und Datenvolumes werden übernommen. [Update und Rollback](UPGRADE-0.4.4.md).
