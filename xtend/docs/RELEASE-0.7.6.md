# XTend.search 0.7.6 — kompakte Filter und native Bildübergänge

Frontend 0.7.6 baut auf dem geprüften 0.7.5-Stand aus [PR #33](https://github.com/konnilabs/xtend-search/pull/33) auf. Solange dieser offen ist, ist der Frontend-PR darauf gestapelt. Vor einem Merge nach `main` muss diese Abhängigkeit aufgelöst sein. Das Backend bleibt **0.7.5**, der SearXNG-Pin und das XTend-0.9.0-SDK bleiben erhalten.

## Verhalten

- Das Filterpanel sitzt auf ausreichend großen Viewports mittig unter dem Formular. Drei Felder und drei Aktionen teilen sich zwei Spalten; der Erklärungstext nutzt darunter die volle Breite. Auf schmalen oder niedrigen Viewports bleibt das Panel innerhalb des Bildschirms, scrollt bei Bedarf intern und behält einen erreichbaren nativen Details-Toggle. Formulare, Filterpersistenz und der No-JS-Pfad bleiben nutzbar.
- Die Bildvorschau besitzt eigene RMT-Surfaces und deklarierte AnimationEngine-Transitions zum Ein- und Ausblenden. Ein Wechsel des ausgewählten Bildes spielt die Öffnungsanimation nicht erneut ab. Navigation verwirft die Vorschau, ausstehende Bildantworten und Animationen bleiben an ihre Generation gebunden.
- Beim Öffnen der XSearchLightbox wird die tatsächlich dargestellte Bildfläche einschließlich Letterboxing in die Vollbildansicht überführt. Der RMT-Compiler liefert den Motion-Preset; die Geometrie verwendet den öffentlichen XUtils-Runner wie bereits der Header. Es gibt keine Bildklone, HTML-Injektionen oder Änderungen am SDK. Reduced Motion überspringt die Bewegung; Schließen, Carousel und Resize beenden laufende Animationen.
- Die Rückkehr zur Startseite leert das Suchfeld über eine RMT-Action. Nach Beginn der Navigation neu eingegebener Text bleibt durch den bestehenden Draft-Schutz erhalten. Der native Löschknopf des Suchfelds bleibt verfügbar; abgebrochene Melde-Verwerfungsdialoge lösen keine Navigation und damit kein Leeren aus.

## Prüfung

Strict-Maraca prüft Search und Observatory einschließlich App Services, HTML-Sicherheitsgrenzen und AnimationEngine. Die versionierten Nachweise unter `xtend/evidence/control-plane/0.7.6-*` unterscheiden Docker-Fixtures, synthetische Bilder, Browsergeometrie und lokale SDK-/CLI-Prüfungen. Reale Suchanbieter werden für die UI-Abnahme nicht abgefragt. Die Bing-Diagnose ist davon unabhängig und ändert keine Providerfreigaben.

## Upgrade und Rollback

Das geprüfte Paar ist **Frontend `xtend-search:0.7.6` / Backend `xtend-search-searxng:0.7.5`**. Es gibt keine Datenmigration. Vor einem Upgrade die Datenvolumes und geschützte Env-Datei sichern. Bestehende Volumenamen, SSO-Daten, Freigaben und Schutzfristen übernehmen. Bereits zentral deaktiviertes Bing bleibt durch die persistierte Policy deaktiviert.

Bei einem bestehenden Portainer-Stack `XTEND_SEARCH_IMAGE` auf `xtend-search:0.7.6` ändern; `XTEND_BACKEND_IMAGE` bleibt `xtend-search-searxng:0.7.5`. Anschließend Browser-Tabs neu laden. Rollback verwendet das bisherige Frontend 0.7.5 mit demselben Backend 0.7.5; vorhandene Datenvolumes werden weiterverwendet. Bei zusätzlicher externer Datenänderung gilt der vorab gesicherte Datenstand. Merge und Produktionsdeployment sind getrennte Schritte.

## Ursprüngliche Abnahme und Performance (R1)

Strict-Maraca und HTML-Sicherheitsprüfung, **163 Control-Node-Tests**, **10 Legacy-Node-Tests**, **8 Python-Vertragstests** und **21 Docker-Browsergates** haben bestanden. Der neue Gate deckt 320–3840 Pixel, niedrige Viewports, No-JS, schnelle Aktionen, Reduced Motion, Fokus-Rückgabe, native Bildgeometrie und verspätete Startseiten-/Streamantworten ab.

Identische Offline-Fixtures auf demselben Host, je fünf Durchläufe: Median bis zum ersten interaktiven Ergebnis **600.1 → 597.9 ms** (-0.4 %), Streamabschluss **3205.4 → 3217.4 ms**, Wiederherstellung **733 → 730 ms**. Jede Wiederherstellung erzeugte null Suchstreams und einen providerfreien Epochen-Request. Der erste Wert ist das Ergebnis-Renderereignis, kein exakter Browser-Paint-Zeitstempel; Heap-Werte sind eine grobe Chromium-Diagnose.

CLS beträgt in den geprüften normalen und gedrosselten Browserfixtures **0**. Gewollte Bewegungen nach Nutzereingaben werden vom Web-Vitals-CLS-Maß ausgenommen; die Rohdaten weisen diese separat aus. Der komprimierte Browser-Modulgraph wächst bei gleicher gzip-Methode um **896 Byte**; CSS und das generierte Maraca-Artefakt werden getrennt in `0.7.6-bundle-sizes.json` ausgewiesen.

Der laufende XTend-MCP lieferte Knowledge-Kontext zur AnimationEngine. Diese Dokumentation ist ausdrücklich von den Nachweisen des tatsächlich gepinnten SDKs, des lokalen Compilers und des gebauten Docker-Images getrennt (`0.7.6-mcp.json`). Die lokale Aktualisierung erhielt alle Umgebungswerte, Volumenamen, Freigaben, Schutzfristen und die Backend-Containeridentität; Sicherung und Datenprüfsummen bleiben geschützt außerhalb des Release-Pakets.

## Nachprüfung des Bilderrasters (R2)

Zwischen 961 und 1199 Pixeln reservierte das gemeinsame Knowledge-Layout eine zweite Spalte auch bei geschlossener Bildvorschau. Eine auf geschlossene Bildansichten begrenzte CSS-Regel gibt dem Raster jetzt die gesamte Ergebnisbreite zurück. Das RMT-gesteuerte Vorschauattribut und die vorhandenen Öffnungs-/Schließanimationen bleiben maßgeblich; es gibt keine zusätzlichen DOM-Eingriffe.

Der neue Browsergate prüft 41 Geometrien für SSR/No-JS, XScaler/Resume, Öffnen, Schließen und die Rückkehr zu gecachten Bildtreffern bei 320–3840 Pixeln. Bei 1122 Pixeln wächst das geschlossene Raster nachweislich von 627 auf alle 1003 verfügbaren Pixel. Gezielte R2-Abnahme: Strict-Maraca/HTML-Sicherheit, erneut 163 Control-Node-Tests sowie fünf Browsergates für Raster, Shell/Motion, Stream-/Spinnerzustände, SSR und native Lightbox-Resilienz. Die ursprünglichen vollständigen R1- und Performancenachweise bleiben separat zugeordnet; R2-Nachweise stehen in `0.7.6-r2-validation.json` und `0.7.6-r2-browser-gates.json`.

Die Frontendversion bleibt vor dem Release 0.7.6; das aktualisierte Docker-Paket ist separat als R2 abgelegt. Image-ID und SHA-256 aus diesem Paket verwenden. Das Backend bleibt unverändert 0.7.5. Die lokale R2-Aktualisierung erfolgte nach erneuter geschützter Sicherung und erhielt wiederum die gespeicherten Daten und Umgebungswerte.
