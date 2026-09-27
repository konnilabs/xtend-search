# Startseitenkorrekturen — 19.09.2026

Zwei nach der ersten MVP-Abnahme gemeldete Fehler sind behoben:

- Kategorie-Vorwahl: `searchUrl` verwirft bei leerem Suchbegriff die Filter nicht mehr. Die Startseite kann etwa `/?categories=images` abbilden. Web/Bilder, bestehende Filter und der Classic-Link verwenden diesen Zustand; die erste Suche übernimmt die gewählte Kategorie. Es wird beim bloßen Kategorie-Wechsel noch keine Suche ausgeführt. Mit JavaScript bleiben Shell und ein schon eingegebener Suchentwurf erhalten.
- Automatischer Dark Mode: `prefers-color-scheme` steuert die gesamte Suchoberfläche einschließlich Startseite, Suchfeld, Filter, Ergebnislisten und Zustandsmeldungen. CSS wirkt bereits im serverseitigen HTML und ohne JavaScript. Ein Wechsel des System-/Browserfarbschemas wird ohne Neuladen übernommen. Die weiterhin separaten Classic-Preferences wurden nicht verändert.

Prüfungen: 7 Unitprüfungen bestanden; 8 zusätzliche Browserfälle in Chromium/Firefox × JavaScript an/aus. Darunter Kategorie-Vorwahl mit Filtern, Back/Forward, erste Bildersuche, Entwurfserhalt, dunkles initiales Layout und dynamischer Wechsel zu Hell/Dunkel. Screenshots und Rohdaten: `evidence/tests/shell-fixes/`. Auf dem Live-Container wurden Readiness, Bilder-Vorwahl, Dark Mode und gültiger Resume nochmals geprüft.

Geändert wurden Adapter-URL-Erzeugung und CSS; RMT-Quelle, Suchkern und XTend-Laufzeit blieben unverändert. Ein neuer Produktionsbuild wurde als Docker-Image gebaut und auf der bestehenden lokalen Instanz aktiviert. Die frühere vollständige Performance-Baseline wurde wegen dieser funktionalen Korrekturen nicht erneut erhoben; ihre Angaben bleiben eine Messung des ursprünglichen MVP-Stands.
