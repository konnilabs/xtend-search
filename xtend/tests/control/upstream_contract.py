"""Offline regression gate for the modified SearXNG boundary.

Run inside Dockerfile.searxng with settings.control.fixture.yml, a test token,
XTEND_TEST_FIXTURE=1 and --network none. Provider methods below are local stubs;
request parsing, processor dispatch, containers and JSON serialization are real.
"""
import json
import threading
import time
import types
import unittest

from werkzeug.test import Client
from werkzeug.wrappers import Response
from xtend.server.backend import application
from searx.webapp import app
from searx.search.processors import PROCESSORS
from searx.results import ResultContainer
from searx.xtend_stream import SnapshotContainer
from searx import result_types


CALLS = []
DELAYS = {'fixture fast': 0.02, 'fixture medium': 0.15, 'fixture slow': 0.5}


def records(name):
    video_type = getattr(result_types, 'Video', result_types.MainResult)
    return [
        result_types.MainResult(url='https://example.org/shared', title='Shared'),
        result_types.Image(url=f'https://example.org/{name}/image', title='Image',
                           img_src='https://images.example.test/original.png'),
        video_type(url=f'https://example.org/{name}/video', title='Video',
                   template='videos.html'),
        {'infobox': 'Text entity', 'id': 'text', 'content': 'Text',
         'urls': [{'title': 'Source', 'url': 'https://example.org/entity'}]},
        {'infobox': 'Image entity', 'id': 'image', 'content': 'Text',
         'img_src': 'https://images.example.test/entity.png',
         'urls': [{'title': 'Source', 'url': 'https://example.org/entity-image'}]},
    ]


for _name, processor in PROCESSORS.items():
    def search(self, query, params, container, start_time, timeout_limit):
        CALLS.append((self.engine.name, query, dict(params)))
        time.sleep(DELAYS.get(self.engine.name, 0))
        container.extend(self.engine.name, records(self.engine.name))
    processor.search = types.MethodType(search, processor)


class UpstreamContract(unittest.TestCase):
    def setUp(self):
        CALLS.clear()
        self.form = {'q': 'contract fixture', 'engines': 'fixture fast', 'format': 'json',
                     'language': 'all', 'safesearch': '0', 'pageno': '1', 'time_range': ''}

    def test_private_host_authentication_and_discovery(self):
        client = Client(application, Response)
        self.assertEqual(client.get('/config').status_code, 403)
        response = client.get('/config', headers={'Authorization': 'Bearer fixture-test-only'},
                              environ_overrides={'REMOTE_ADDR': '127.0.0.1'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['X-XTend-Backend-Contract'], 'engine-json-v1')
        config = response.json
        self.assertFalse(any(p['enabled'] for p in config['plugins']))
        self.assertIn('fixture fast', [e['name'] for e in config['engines']])
        self.assertEqual(client.get('/preferences', headers={'Authorization': 'Bearer fixture-test-only'}).status_code, 404)

    def test_explicit_engine_filters_and_json_attribution(self):
        response = app.test_client().post('/search', data={**self.form, 'safesearch': '1', 'pageno': '2', 'time_range': 'month'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([call[0] for call in CALLS], ['fixture fast'])
        params = CALLS[0][2]
        self.assertEqual((params['safesearch'], params['pageno'], params['time_range']), (1, 2, 'month'))
        self.assertNotIn('xtend', response.json)
        self.assertEqual(response.json['unresponsive_engines'], [])
        self.assertTrue(all(r['engines'] == ['fixture fast'] for r in response.json['results']))
        self.assertIn('videos.html', [r['template'] for r in response.json['results']])
        self.assertEqual(len(response.json['infoboxes']), 2)

    def test_isolation_parser_negative_controls(self):
        client = app.test_client()
        for query in ['hello world', 'site:example.org cats', 'safe!middle', 'a\u00a0b']:
            CALLS.clear()
            self.assertEqual(client.post('/search', data={**self.form, 'q': query}).status_code, 200)
            self.assertEqual([call[0] for call in CALLS], ['fixture fast'])
        CALLS.clear()
        client.post('/search', data={**self.form, 'q': '!fixturemedium cats'})
        self.assertEqual([call[0] for call in CALLS], ['fixture medium'])
        CALLS.clear()
        client.post('/search', data={**self.form, 'categories': 'general'})
        self.assertIn('fixture slow', [call[0] for call in CALLS])
        self.assertGreater(len(CALLS), 1)

    def test_snapshot_copies_typed_results_without_closing_original(self):
        stopped = threading.Event()
        snapshots = []
        container = SnapshotContainer(snapshots.append, stopped)
        container.extend('fixture fast', records('fixture fast'))
        self.assertEqual(len(snapshots), 1)
        self.assertFalse(container._closed)
        self.assertTrue(snapshots[0]._closed)
        snapshots[0].infoboxes[0]['content'] = 'Changed copy'
        self.assertEqual(container.infoboxes[0]['content'], 'Text')
        container.extend('fixture medium', records('fixture medium'))
        stopped.set()
        container.extend('fixture slow', records('fixture slow'))
        self.assertFalse(container._closed)
        self.assertEqual(len(snapshots), 2)
        container.close()
        baseline = ResultContainer()
        for name in ['fixture fast', 'fixture medium']:
            baseline.extend(name, records(name))
        baseline.close()
        self.assertEqual([(r.url, r.score, sorted(r.engines)) for r in container.get_ordered_results()],
                         [(r.url, r.score, sorted(r.engines)) for r in baseline.get_ordered_results()])

    def test_incremental_feed_precedes_completion_and_keeps_final_core_ranking(self):
        form = {**self.form, 'engines': 'fixture fast,fixture medium,fixture slow'}
        headers = {'X-SearXNG-XTend-Stream': '1', 'X-SearXNG-XTend-Contract': '1'}
        start = time.monotonic()
        response = app.test_client().post('/search', data=form, headers=headers, buffered=False)
        self.assertEqual(response.mimetype, 'application/x-ndjson')
        frames = []
        snapshot_at = None
        for chunk in response.response:
            frame = json.loads(chunk)
            frames.append(frame)
            if frame['kind'] == 'snapshot' and snapshot_at is None:
                snapshot_at = time.monotonic() - start
        complete_at = time.monotonic() - start
        response.close()
        self.assertEqual(frames[0]['kind'], 'start')
        self.assertEqual(frames[-1]['kind'], 'complete')
        self.assertIsNotNone(snapshot_at)
        self.assertLess(snapshot_at, complete_at - 0.2)
        self.assertEqual(set(call[0] for call in CALLS), set(DELAYS))
        final = frames[-1]['data']
        ordinary = app.test_client().post('/search', data=form,
                                        headers={'X-SearXNG-XTend-Contract': '1'}).json
        self.assertEqual(final['results'], ordinary['results'])
        self.assertEqual(final['infoboxes'], ordinary['infoboxes'])
        self.assertEqual(final['unresponsive_engines'], [])
        self.assertTrue(final['xtend']['paging'])
        self.assertEqual(final['xtend']['state']['safesearch'], 0)

    def test_favicon_adapter_uses_existing_cache_independently(self):
        client = Client(application, Response)
        headers = {'Authorization': 'Bearer fixture-test-only'}
        first = client.get('/xtend/favicon?domain=contract.example.org', headers=headers)
        second = client.get('/xtend/favicon?domain=contract.example.org', headers=headers)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.mimetype, 'image/png')
        self.assertEqual(first.data, second.data)
        self.assertEqual(client.get('/xtend/favicon?domain=missing.example.org', headers=headers).status_code, 204)
        self.assertEqual(client.get('/xtend/favicon?domain=localhost', headers=headers).status_code, 400)


if __name__ == '__main__':
    unittest.main(verbosity=2)
