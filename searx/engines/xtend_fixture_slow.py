"""Second offline engine: proves early batches and final upstream deduplication."""
import os
import time
from searx.result_types import EngineResults
from searx.engines.xtend_fixture import search as fixture_search

engine_type = 'offline'
categories = ['general', 'images']
paging = True
timeout = 4.0
disabled = True


def search(query, params):
    if os.environ.get('XTEND_TEST_FIXTURE') != '1':
        raise RuntimeError('Fixture is disabled')
    if not query.startswith('stream '):
        return EngineResults()
    time.sleep(1.8)
    results = fixture_search(query, params)
    if params.get('category') == 'images' and query.startswith('stream media'):
        results.append({'template': 'images.html', 'url': 'https://example.org/late-image',
                        'title': 'Später Bildtreffer', 'thumbnail_src': 'https://images.example.test/thumb-6.png',
                        'img_src': 'https://images.example.test/original-6.png'})
    else:
        results.append({'url': 'https://example.org/late-result',
                        'title': 'Später Treffer', 'content': 'Die zweite Engine ist fertig.'})
    return results
