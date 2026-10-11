"""Authenticated metadata-only view of the native SearXNG suspension state."""
import hashlib
import json
import time
from uuid import uuid4
from urllib.parse import parse_qs
from searx.search.processors import PROCESSORS

INSTANCE_ID = str(uuid4())
SCHEMA = 'xtend.engine-health.v1'

def error_class(reason):
    reason = str(reason).lower()
    if 'captcha' in reason:
        return 'captcha'
    if 'toomany' in reason or 'rate' in reason:
        return 'rate_limit'
    if 'accessdenied' in reason or 'forbidden' in reason:
        return 'access_denied'
    if 'timeout' in reason:
        return 'timeout'
    return 'unknown' if reason else None

def snapshot(names=()):
    rows = []
    for name in names:
        processor = PROCESSORS[name]
        status = processor.suspended_status
        siblings = sorted(n for n, p in PROCESSORS.items() if p.suspended_status is status)
        scope = hashlib.sha256(json.dumps(siblings, ensure_ascii=True).encode()).hexdigest()[:32]
        with status.lock:
            remaining = max(0, round((status.suspend_end_time - time.perf_counter()) * 1000))
            reason = error_class(status.suspend_reason) if remaining else None
        rows.append({'id': name, 'scope': scope, 'remainingMs': remaining, 'errorClass': reason})
    return {'schema': SCHEMA, 'instanceId': INSTANCE_ID, 'engines': rows}

def handle(environ, start_response):
    try:
        if environ.get('REQUEST_METHOD') != 'GET':
            raise ValueError('method')
        query = environ.get('QUERY_STRING', '')
        params = parse_qs(query, keep_blank_values=True, max_num_fields=16)
        names = params.get('engine', [])
        if len(query) > 4096 or set(params) - {'engine'} or len(names) > 16 or len(set(names)) != len(names) or any(n not in PROCESSORS for n in names):
            raise ValueError('engines')
        payload = snapshot(names)
    except (ValueError, KeyError):
        start_response('400 Bad Request', [('Content-Type', 'application/json'), ('Cache-Control', 'no-store')])
        return [b'{"error":"invalid_health_request"}']
    start_response('200 OK', [('Content-Type', 'application/json'), ('Cache-Control', 'no-store'), ('X-XTend-Engine-Health-Contract', 'engine-health-v1')])
    return [json.dumps(payload, separators=(',', ':')).encode()]
