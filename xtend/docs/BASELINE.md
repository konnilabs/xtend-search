# Reproduzierbarer Vergleich

Die ausgelieferte Messung verwendet denselben SearXNG-Commit, dieselben Python-Abhängigkeiten, dieselbe lokale Fixture-Engine und dieselben Granian-Threadgrenzen. Die veränderte App wird vom Supervisor auf 8080/8081/8082 betrieben; Upstream läuft getrennt auf 8084, hinter einem identischen gzip-Gateway auf 8094. Der Fixture-Schalter muss für beide aktiv sein.

Eine saubere lokale Kopie des Upstreams außerhalb der Produktquellen anlegen:

```sh
git clone https://github.com/searxng/searxng.git ../searxng-baseline
git -C ../searxng-baseline checkout e831fc2a1cad50c9979b5f6f680376410218188c
cp searx/engines/xtend_fixture.py ../searxng-baseline/searx/engines/xtend_fixture.py
```

Im Projekt-Wurzelordner, nach Anlegen der Python-Umgebung gemäß README, in drei getrennten Terminals starten (absolute Pfade werden hier aus dem Arbeitsordner ermittelt):

```sh
XTEND_TEST_FIXTURE=1 XTEND_PYTHON="$PWD/.venv/bin/python" node xtend/server/supervisor.mjs
```

```sh
XTEND_TEST_FIXTURE=1 SEARXNG_SECRET=fixture-baseline-only \
SEARXNG_SETTINGS_PATH="$PWD/xtend/config/settings.fixture.yml" \
PYTHONPATH="$(realpath ../searxng-baseline)" \
.venv/bin/granian --interface wsgi --host 127.0.0.1 --port 8084 \
  --blocking-threads 4 --backpressure 32 searx.webapp:app
```

```sh
FRONTEND_MODE=classic PORT=8094 XTEND_CORE_PORT=8084 node xtend/server/gateway.mjs
```

Dann:

```sh
cd xtend
TEST_BASE_URL=http://127.0.0.1:8080 BASELINE_URL=http://127.0.0.1:8094 node tests/benchmark.mjs
node tests/load.mjs
```

Vorher einen auf Port 8080 laufenden Live-Container stoppen oder andere Ports verwenden. Keine Lasttests gegen echte externe Suchquellen ausführen. Upstream-Templates, JavaScript und CSS werden nicht editiert; ausschließlich die zusätzliche Fixture-Engine dient als Messinstrument. `load.mjs` verwendet feste lokale URLs und nur Fixtures, 30 Requests pro Concurrency 1/5/20. Dies sind kurze Labortests, kein Soak-Test.

Die Browserreihe misst immer 50 identische Treffer. X0 hat deaktiviertes JavaScript; sein LCP-Observer läuft folglich nicht. X0-LCP/CLS-Nullen in der Rohdatei bedeuten „nicht beobachtet“. Die SPA-Navigationsreihe wechselt lediglich den Sprachfilter bei identischem Resultset; sie misst deshalb eine günstige, gleich große Aktualisierung, keinen maximalen Austausch aller Ergebnisidentitäten. Eine vollständige Neuordnung ist durch Funktionstests abgedeckt, aber nicht durch diese Performancezahl.
