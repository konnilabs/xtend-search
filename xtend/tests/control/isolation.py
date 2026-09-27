"""Pinned upstream request-parser AND actual processor dispatch evidence.
No live engines: test processors record dispatch and return local data.
"""
import json
import types
from searx.webapp import app
from searx.search.processors import PROCESSORS
from searx.webadapter import get_search_query_from_webapp
from searx.search import Search
from searx import settings
from searx.preferences import Preferences
from searx.engines import engines, categories
from searx.plugins import STORAGE
calls = []
for name, processor in PROCESSORS.items():
    def search(self, query, params, result_container, start_time, timeout_limit):
        calls.append(self.engine.name)
        result_container.extend(self.engine.name, [{'url':'https://example.org/proof', 'title':'Fixture'}])
    processor.search = types.MethodType(search, processor)
checks = []
with app.test_request_context('/'):
    from searx.webapp import pre_request
    pre_request()
    from searx import sxng_locales
    from searx.webapp import sxng_request
    def run(form):
        calls.clear()
        query, *_ = get_search_query_from_webapp(sxng_request.preferences, form)
        Search(query).search()
        return list(calls)
    baseline = {'q':'open source site:example.org', 'engines':'fixture fast', 'format':'json', 'language':'all', 'safesearch':'0'}
    assert run(baseline)==['fixture fast'];checks.append('explicit valid single engine dispatch isolated')
    for q in ['hello world', 'site:example.org cats', '"!xtslow"', 'safe!middle', 'a\u00a0b', 'a\u2003b']:
        assert run({**baseline,'q':q})==['fixture fast']
    checks.append('ordinary syntax and unicode whitespace preserve isolation')
    assert set(run({**baseline,'categories':'general'}))=={'fixture fast','fixture medium','fixture slow'}
    checks.append('negative control: category adds unplanned engine')
    assert run({**baseline,'q':'!fixturemedium open source'})==['fixture medium']
    checks.append('negative control: bang replaces planned engine')
    assert set(run({**baseline,'engines':'unknown'}))=={'fixture fast','fixture medium','fixture slow'}
    checks.append('negative control: unknown engine expands default pool')
print(json.dumps({'ok':True,'scope':'actual pinned SearXNG Search._get_requests/_search_with_accepted_requests processor dispatch, no external networking','checks':checks}))
