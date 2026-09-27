"""Private SearXNG host: authentication and metadata-only logging, no search API fork."""
import hmac
import logging
import os
from pathlib import Path

# Provider exceptions and request URLs may include search content. Install a
# redacting factory BEFORE importing SearXNG or HTTP libraries; no raw record is
# delivered to a handler, including handlers installed later by dependencies.
original_factory = logging.getLogRecordFactory()
def private_record(*args, **kwargs):
    record = original_factory(*args, **kwargs)
    record.msg = 'backend_event'
    record.args = ()
    record.exc_info = None
    record.exc_text = None
    record.stack_info = None
    return record
logging.setLogRecordFactory(private_record)
from searx.webapp import app
from searx import get_setting
if set(get_setting("preferences.lock", set())) & {"categories", "language", "safesearch"}:
    raise RuntimeError("Unsupported locked retrieval parameters")

# Local cooldowns are conservative upper bounds for this validated profile;
# a deployment increasing native suspension must update the adapter contract.
for error, seconds in get_setting("search.suspended_times").items():
    ceiling = 1296000 if "Captcha" in error else 86400 if "AccessDenied" in error else 3600
    if seconds > ceiling:
        raise RuntimeError("Backend suspension exceeds reviewed contract")
if get_setting("search.max_ban_time_on_fail") > 3600:
    raise RuntimeError("Backend backoff exceeds reviewed contract")

def read_secret(name):
    file = os.environ.get(name + '_FILE')
    return Path(file).read_text().strip() if file else os.environ.get(name, '')
token = read_secret('SEARXNG_TOKEN')
if not token:
    raise RuntimeError('SEARXNG_TOKEN is required')

from xtend.server import favicon_backend

def application(environ, start_response):
    if environ.get('PATH_INFO') == '/healthz':
        start_response('200 OK', [('Content-Type', 'text/plain')])
        return [b'OK']
    supplied = environ.get('HTTP_AUTHORIZATION', '')
    if not hmac.compare_digest(supplied, 'Bearer ' + token):
        start_response('403 Forbidden', [('Content-Type', 'text/plain')])
        return [b'Forbidden']
    if environ.get('PATH_INFO') == '/xtend/favicon':
        return favicon_backend.handle(environ, start_response)
    if environ.get('PATH_INFO') not in ['/config', '/search']:
        start_response('404 Not Found', [('Content-Type', 'text/plain')])
        return [b'Not Found']
    def contract_response(status, headers, exc_info=None):
        headers.append(("X-XTend-Backend-Contract", "engine-json-v1"))
        if favicon_backend.available():
            headers.append(("X-XTend-Favicon-Contract", "favicon-v1"))
        return start_response(status, headers, exc_info)
    return app(environ, contract_response)
