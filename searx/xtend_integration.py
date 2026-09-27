"""Private presentation metadata; search, ranking and plugins stay upstream-owned."""
import json
import os
from searx.utils import html_to_text


def _plain(value, limit=1600):
    if isinstance(value, (list, tuple)):
        value = ', '.join(_plain(item, 300) for item in value[:20])
    if not isinstance(value, (str, int, float)):
        return ''
    return html_to_text(str(value))[:limit]


def enrich_response(serialized, query, container, request, image_proxify):
    data = json.loads(serialized)
    data['xtend'] = {
        'schema': 'searxng-xtend.core.v1',
        'state': {
            'q': request.form.get('q', ''),
            'categories': sorted(query.categories),
            'language': query.lang,
            'time_range': query.time_range or '',
            'safesearch': query.safesearch,
            'pageno': query.pageno,
        },
        # Upstream indicates paging capability, not a guaranteed next result.
        'paging': bool(container.paging),
        'fixture': os.environ.get('XTEND_TEST_FIXTURE') == '1',
    }
    def proxy(source):
        if not isinstance(source, str) or not source.startswith(('http://', 'https://', '//')):
            return ''
        if not request.preferences.get_value('image_proxy'):
            return ''
        value = image_proxify(source)
        return value if value and value.startswith('/image_proxy?') else ''

    for result in data.get('results', []):
        thumbnail = result.get('thumbnail_src') or result.get('img_src')
        result['xtend_thumbnail'] = proxy(thumbnail)
        result['xtend_image'] = proxy(result.get('img_src'))
    for box in data.get('infoboxes', [])[:3]:
        box['xtend_image'] = proxy(box.get('img_src'))
        box['xtend_content_text'] = _plain(box.get('content'), 5000)
        for attribute in box.get('attributes', [])[:20]:
            attribute['xtend_value_text'] = _plain(attribute.get('value'))
            image = attribute.get('image') or {}
            attribute['xtend_image'] = proxy(image.get('src'))
    return json.dumps(data, ensure_ascii=False)
