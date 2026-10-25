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
