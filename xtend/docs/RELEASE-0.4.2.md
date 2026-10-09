# XTend.search 0.4.2 – CCS-Shell und geprüftes SearXNG-Update

9. Oktober 2026. **Frontend und erweitertes Backend 0.4.2** bilden ein zusammenpassendes Paar. XTend bleibt auf **0.8.0 / Hydrangea** samt überprüftem SSR-Overlay aus 0.4.1. Keine Speichermigration, keine Änderungen an SSO, Rollen, Budgets oder Qualitätsregeln.

## Produktänderungen

- Ein einziges keyed Suchformular liegt jetzt mit Moduswahl und Filtern im Header. Logo, Favicon und „Neugier braucht Freiraum.“ bleiben erhalten.
- Kategorie-Links verwenden die aktuellen nativen Formularwerte statt älterer Server-URLs. Sprach-, Zeitraum- und SafeSearch-Entwürfe bleiben während XScaler-Batches erhalten. PageClient emittiert auch für optimistische Commits `navigate`; diese Events werden nicht mehr als neue Filterentscheidung behandelt. Echte Navigation und Back/Forward übernehmen den passenden Seitenstand. Ohne JavaScript bleiben GET-Formulare und Links nutzbar.
- Header-About und Ergebnis-Meldungen verwenden echte `x-icon`-Komponenten mit lokalem Core-Pack (`info`, `warning`), zugänglichem Namen, Tastaturbedienung und nativer Zieladresse. Es gibt keine neue Icon-Bibliothek.
- Suche, Observatory und Anmeldung teilen dieselben CSS-Tokens. Das Dashboard nutzt ruhige Flächen, dünne Linien und 3px-Ecken statt der alten blauen, stark gerundeten Karten. XSurfaceManager/XSidePanel und die sechs Arbeitsbereiche bleiben erhalten.
- Die Anmeldung verwendet einen echten XButton mit **„Anmelden mit CCS Account“**. Erst nach erfolgreichem Component-Upgrade ersetzt er den nativen Link. `click` und `setLoading()` führen zum bestehenden `/admin/login`; Nextcloud-OAuth2 und Kontofreigaben bleiben unverändert.

Die dunkle Palette wurde aus dem am 09.10.2026 abgerufenen [CCS-Networks-Auftritt](https://ccs-networks.de/) abgeleitet: Hintergrund `#090909`, Panel `#10100f`, erhöhte Fläche `#181715`, Text `#eeeae3`, Sekundärtext `#b5afa6`, Linie `#36332e`, Akzent `#d5bea0`. CCS stellt dort keine separat verifizierte helle Palette bereit; die helle Variante ist eine passende Ableitung aus Creme, warmem Weiß und Braun. Die cyanfarbene XTend-Wortmarke bleibt bewusst bestehen. Es werden keine externen Schriftarten geladen.

## SearXNG und Streaming

Der vollständige Upstream-Stand [`9f042d2f67666f86204d6874488880a23ba81a8f`](https://github.com/searxng/searxng/commit/9f042d2f67666f86204d6874488880a23ba81a8f) mit Kennung `2026.10.9+9f042d2f6` ersetzt `e831fc2a1` vom 19.09.2026. 45 Commits wurden mit ihrer Git-Lineage integriert. [Vorprüfung und Änderungen](SEARXNG-UPSTREAM-REVIEW-2026-10-09.md) erläutern den Nutzen und die Grenzen.

`msgspec` wird auf 0.22.0, `granian` auf 2.8.4 angehoben. Frozen-Core-Kennung, Frontend-Pin und Manifest mit 17 geprüften Datei-Hashes werden gemeinsam aktualisiert. Ein beliebiges offizielles SearXNG-Image erfüllt diesen privaten Backend-Vertrag weiterhin nicht.

Beide Streamingpfade bleiben erhalten: Der aktuelle Standalone-Executor publiziert abgeschlossene Engine-Dispatches durch echte XTend-AppServices/XScaler; der historische Python-Snapshot-Adapter kopiert Zwischenstände unter Lock und verwendet weiterhin die normale finale `ResultContainer.close()`-Logik. Typed Images/Video, Infobox-Sortierung, Serializer, Filter und private Auth-Grenzen sind Teil des Python-Gates. Drei allgemeine Quellen und ein eigener Knowledge-Platz bleiben unabhängig.

Upstream setzt `artic`, `devicons`, `flickr` und `lucide` neu auf `disabled: true`. Geänderte Katalog-Fingerprints verlangen eine neue administrative Prüfung; neue Quellen erhalten keine Freigabe. Unveränderte Katalogmetadaten beweisen keine unveränderte Engine-Implementierung. Es werden keine technischen Sperrfristen oder Qualitätspausen gelöscht. Produktions-Provider-Verfügbarkeit ist durch lokale Fixture-Tests nicht bewiesen.

## Abnahme und Größen

- 68 Node-Anwendungs-/Vertragstests, Maraca-Build und sechs Python-Boundary-Tests mit `--network none` bestanden.
- Reale Docker-Browsertests: Filterwechsel all/en/de, Kategorie-URLs, Back/Forward, Entwürfe während laufender Streams; XIcon, XButton, Tastatur und Light/Dark bei 320–3840px.
- Bestehende Gates: signiertes Resume und manipulierte Signatur mit Descriptor-Fallback; fehlende/fehlerhafte/duplizierte Streamframes; Preview-/Bildfehler-Erholung und XLightbox; langsame Favicons ohne Streamblockade; Meldungen, Rollen, Inbox, Regeln, live aktualisierte ungespeicherte Formulare; Cookie-Filterstand und administrative SafeSearch-Ausnahme; About und No-JS.
- OAuth verwendet einen lokalen Nextcloud-Vertragsstub. Ein neuer interaktiver Produktions-SSO-Test wird nicht behauptet.

| Distributable | 0.4.1 Bytes / gzip | 0.4.2 Bytes / gzip |
| --- | ---: | ---: |
| Suche `page.mjs` | 20.342 / 7.568 | 21.922 / 8.008 |
| Suche CSS | 28.011 / 6.927 | 35.712 / 8.367 |
| Observatory `page.mjs` | 241.099 / 61.215 | 241.099 / 61.215 |
| Observatory CSS | 34.049 / 7.990 | 38.234 / 8.732 |
| Separates Login-Modul | – | 49.745 / 14.212 |

Messwerte kommen aus den gebauten Images; JavaScript-Splitchunks sind in diesen Entry-Werten nicht enthalten. Das Login-Modul wird nur auf der nicht angemeldeten Adminseite geladen. Dynamische SSR-Signaturen und Zeitstempel variieren. Fixture-Streaming und Wire-/Coverage-Messungen stehen in `xtend/evidence/control-plane/0.4.2-acceptance.json`; dies sind lokale Transport-/Vertragsmessungen, keine Produktionslatenz-Zusage.

## XTend-Verträge und Nachweise

RMT und Maraca bleiben die Render-/Resume-Grundlage. Verwendet werden PageClient `visit`/History/optimistische Commits, `dispatchCommand` für den Filterzustand, registrierte XIcon-Core-Icons, XButton-`click`/`setLoading`, öffentliche CSS-Tokens/Parts und vorhandene AppService-XScaler-Streams. Kein React/Vue und kein zweiter Router oder selbst erfundenes Streamingprotokoll.

In dieser Sitzung waren keine aufrufbaren XTend-MCP-Tools vorhanden. Verwendet wurden das lokale SDK, dessen Komponentenquellen und Dokumentation, der echte Maraca-Compiler sowie Docker-/Browsertests. Die MCP-Leistung wird daher nicht als erfolgreich getestet ausgegeben. Framework-Overlay und dessen Hash-Gates aus [0.4.1](RELEASE-0.4.1.md) bleiben wirksam.

XButton 0.8.0 enthält eine statische Spinner-Deklaration `style="display:none"`. Nur die Login-CSP erlaubt deren konkreten SHA-256 per `style-src-attr 'unsafe-hashes'`; Style-Tags erhalten einen Nonce. Arbiträre Inline-Styles oder Inline-Scripts werden nicht freigegeben. Der Browsertest prüft auf CSP-Verstöße.

Neue Browser-CI ergänzt Maraca/Node und Offline-Python um das gebaute Image-Paar samt OAuth-Fixture, SSR, Layouts, About und Streamkanten. Historische Evidence-Dateien behalten ihren ursprünglichen Inhalt; neue Nachweise verwenden 0.4.2-Dateinamen.

## Auslieferung

Ladbare Linux-amd64-Archive für beide Images, SHA-256-Dateien, Image-IDs und Portainer-Paket. Export prüft Quellen, Backend-Pin und SDK-Overlay gegen die tatsächlichen Images. Alle Datenvolumes und echten Env-Werte bleiben außerhalb des Pakets. [Update und gepaarter Rollback](UPGRADE-0.4.2.md).

Der alte monolithische 0.2.x-Host wird in diesem Release nicht neu ausgeliefert. Sein Core-Frozen-Pin ist für zukünftige Builds angeglichen; die neue Auslieferung betrifft den Standalone-Stack. Der Produktionsserver wird durch diese lokale Entwicklung nicht verändert.
