# XTend.search 0.4.3 – klassische, reduzierte Startseite

9. Oktober 2026. Frontend **0.4.3**, erweitertes SearXNG-Backend **0.4.2**, XTend **0.8.0 / Hydrangea**.

Die Startseite zeigt wieder eine mittig angeordnete Suchleiste unter Wortmarke und „Neugier braucht Freiraum.“. Der gefüllte Header erscheint nur in der Ergebnisansicht. „DEIN FENSTER INS WEB“ sowie der Infoblock mit Einführung und drei Stichpunkten sind aus dem RMT-Template entfernt. Die neuen CCS-Farben und die XIcon-Bedienelemente bleiben bestehen. Der Footer erreicht auch bei wenig Inhalt den unteren Viewportrand.

## Render- und Transition-Vertrag

Ein einziges keyed Formular bleibt im Header-DOM gemountet. Auf der Startseite verteilt CSS Grid seine Elemente ohne sichtbare Headerfläche. Nach einer Suche positioniert derselbe DOM-Baum das Formular im Ergebnisheader. Kein Duplikat, keine Reparenting-Routine, kein zusätzlicher Router. Die CSS-Geometrie ist für native SSR-Nodes und den öffentlichen XSection-Part `content` identisch, damit das Component-Upgrade keine schmale Spalte oder Layoutsprünge erzeugt.

Die dokumentierte XTend-API `XUtils.runUiTransition()` animiert den Formularwechsel mit `effect: 'layout-flip'`, stabilem `layoutKey` und gemessenen Transform-Keyframes. Die SDK-Standard-Keyframes für `layout-flip` enthalten selbst keinen vollständigen Vorher-/Nachher-Positionsvergleich; deshalb liefert der App-Host diese zwei Geometriezustände. Ein separates Hintergrundelement fadet ein, sodass das Formular seine eigene Bewegung behält.

PageClient bleibt für Navigation, History und Commits zuständig. Die App misst bei `pending` und dekoriert den folgenden tatsächlichen Home-/Result-Wechsel. Optimistische XScaler-Batches und Filterwechsel innerhalb derselben Ansicht starten keine neue Bewegung. Keine Commit-Verzögerung, keine zusätzlichen Datenanfragen und keine geklonten Bedienelemente. Die Animation dauert 320ms; neue Navigation, Resize, geänderte Bewegungspräferenz oder Pagehide brechen ausschließlich die eigenen Animationen ab. Fertige Web-Animations-Effekte werden entfernt.

`prefers-reduced-motion: reduce` verwendet das fertige Layout sofort. Ohne JavaScript und ohne Animation-Unterstützung bleiben native Suche und die zwei Layouts nutzbar. Das generelle PageClient-Fading bleibt deaktiviert, damit nicht zusätzlich der gesamte Dokumentinhalt animiert wird. Der dokumentierte Maraca-Bootstrap reicht einen frei definierten PageClient-Transition-Callback im vorhandenen 0.8.0-Paket nicht weiter; es wurde dafür kein Framework-API erfunden oder SDK-Overlay erweitert.

## Prüfung und Auslieferung

Maraca-/Node-Gates sowie reale Docker-Browsertests prüfen die zentrierte Startseite, entfernte Texte, volle Viewporthöhe, Footer, Dark/Light bei 320–3840px, dasselbe Eingabeelement vor/nach Navigation, echtes XUtils-Morphing, separates Header-Fading, Back/Forward, Reduced Motion und die Suche ohne JavaScript. Die bisherigen Filter-, SSR-/Resume-, Bild-/Stream-, About-, SSO-Fixture- und Observatory-Gates bleiben aktiv.

Nachweise: `xtend/evidence/control-plane/0.4.3-*`. Aufrufbare XTend-MCP-Tools waren weiterhin nicht verfügbar; lokales SDK, öffentliche Parts/API, Maraca und echte Browsertests wurden verwendet. Keine neue Prüfung des produktiven Nextcloud-Logins wird behauptet.

Die initiale Such-Entry-Datei wächst gegenüber 0.4.2 von 21.922 auf etwa 37.800 Bytes (gzip etwa 12.900 statt 8.008 Bytes); CSS wächst von 35.712 auf etwa 38.150 Bytes. Diese Entry-Messung enthält keine Split-Chunks. Die zusätzliche XUtils-Nutzung ist Bestandteil des lokalen SDK, keine neue Fremdabhängigkeit. Streaming wartet nicht auf Animationen; das bestehende Gate mit absichtlich vier Sekunden langsamen Favicons bleibt aktiv. Die vereinfachte Startseite spart gleichzeitig RMT-/Resume-Markup. Exakte gebaute Größen und Wire-Messungen stehen in der Release-Evidence.

Das Frontend erhält ein neues, unverwechselbares Docker-Archiv mit Prüfsumme und Image-ID. Die bestehende 0.4.2-Auslieferung wird nicht überschrieben. [Update und Rollback](UPGRADE-0.4.3.md).
