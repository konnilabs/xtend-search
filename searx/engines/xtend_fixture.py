"""Explicitly enabled offline fixture. Never registered by the live profile."""
import os
import time
from urllib.parse import quote
from searx.result_types import EngineResults

engine_type = 'offline'
categories = ['general', 'images']
paging = True
time_range_support = True
safesearch = True
timeout = 4.0
disabled = True


def search(query, params):
    if os.environ.get('XTEND_TEST_FIXTURE') != '1':
        raise RuntimeError('Fixture engine requires XTEND_TEST_FIXTURE=1')
    if query.startswith('stream '):
        query = query[len('stream '):]
    if query.startswith('slow'):
        time.sleep(0.65)
    else:
        time.sleep(0.04)
    if query == 'error':
        raise RuntimeError('Deliberate fixture engine failure')
    results = EngineResults()
    if query == 'empty':
        return results
    page = int(params.get('pageno', 1))
    if query.startswith('media'):
        if params.get('category') == 'images':
            for index in range(101 if query == 'media alerts' else 6):
                results.append({
                    'template': 'images.html',
                    'url': f'https://example.org/gallery/{index // 2}',
                    'title': f'Landschaft {index + 1} — offene Bildsammlung',
                    'content': 'Ein reproduzierbares Testmotiv für die Bildvorschau.',
                    'thumbnail_src': f'https://images.example.test/thumb-{index}.png',
                    'img_src': f'https://images.example.test/original-{index}.png',
                    'resolution': '1600 × 1000', 'img_format': 'PNG', 'filesize': '240 KB',
                    'author': 'XTend Testsammlung',
                    'formats': [{'url': f'https://images.example.test/original-{index}.webp', 'label': 'WebP'}],
                })
            return results
        results.append({
            'infobox': 'Offenes Web', 'id': 'https://example.org/open-web',
            'content': '<p>Das <b>offene Web</b> verbindet Wissen, Menschen &amp; Ideen.</p>',
            'img_src': 'https://images.example.test/knowledge.png',
            'urls': [{'title': 'Wikipedia', 'url': 'https://de.wikipedia.org/wiki/World_Wide_Web'},
                     {'title': 'W3C', 'url': 'https://www.w3.org/'}],
            'attributes': [{'label': 'Grundlagen', 'value': ['HTML', 'CSS', 'JavaScript']},
                           {'label': 'Ausrichtung', 'value': '<b>Offene Standards</b>'}],
            'relatedTopics': [{'name': 'Verwandte Themen', 'suggestions': ['Webstandards', 'Barrierefreiheit']}],
        })
        if query == 'media only':
            return results
    entries = [
        ('developer.mozilla.org', 'MDN Web Docs', 'Fundiertes Wissen, praktische Anleitungen und offene Standards für das Web.'),
        ('docs.docker.com', 'Docker Documentation', 'Anwendungen entwickeln, als Container bauen und zuverlässig bereitstellen.'),
        ('github.com', 'Open Source entdecken', 'Projekte, Werkzeuge und Ideen aus der weltweiten Entwicklergemeinschaft.'),
        ('wikipedia.org', 'Wissen gemeinsam erweitern', 'Hintergründe, Zusammenhänge und weiterführende Quellen im Überblick.'),
        ('web.dev', 'Ein besseres Web gestalten', 'Praxiswissen zu Performance, Barrierefreiheit und modernen Webanwendungen.'),
        ('python.org', 'Python — einfach weiterdenken', 'Dokumentation, Lernmaterialien und die vielseitige Sprache für deine Projekte.'),
    ]
    if query == 'benchmark50':
        entries = (entries * 9)[:50]
    for index, (domain, title, content) in enumerate(entries):
        results.append({
            'url': f'https://{domain}/?topic={quote(query)}&page={page}&item={index}',
            'title': f'{query} — {title}',
            'content': content,
        })
    return results
