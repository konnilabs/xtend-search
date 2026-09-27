"""Offline, explicit control-plane fixtures. Never enabled in live settings."""
import os
import time
from searx.result_types import EngineResults
engine_type = 'offline'
categories = ['general']
paging = True
safesearch = True
time_range_support = True
timeout = 4.0
disabled = True
name = 'control fixture'
delay = 0.1
fixture_kind = 'general'

def search(query, params):
    if os.environ.get('XTEND_TEST_FIXTURE') != '1':
        raise RuntimeError('Fixture disabled')
    time.sleep(delay)
    results = EngineResults()
    if query == 'empty':
        return results
    if query.startswith('error'):
        raise RuntimeError('synthetic failure')
    page = params.get('pageno', 1)
    for index in range(4):
        url = f'https://example.org/{name.replace(" ","-")}/{page}/{index}'
        if index == 0:
            url = f'https://example.org/shared/{page}'
        record = {'url':url, 'title':f'{name} — {query} — Ergebnis {index + 1}', 'content':'Stabile Testdaten. Diese Suche kontaktiert keine externen Provider.'}
        if fixture_kind == 'images':
            record.update({'template':'images.html','img_src':f'https://images.example.test/{index}.png','thumbnail_src':f'https://images.example.test/thumb-{index}.png','resolution':'1600 × 900'})
        results.append(record)
    return results
