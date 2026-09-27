"""Private favicon adapter over SearXNG resolver/cache, with independent limits."""
import io
import os
import re
import time
import threading
from urllib.parse import parse_qs
from searx.favicons.cache import FaviconCacheSQLite, FaviconCacheConfig
from searx.favicons.resolvers import duckduckgo
from PIL import Image
_enabled = os.environ.get("XTEND_FAVICON_RESOLVER", "duckduckgo")
if _enabled not in ("duckduckgo", "off"):
    raise RuntimeError("Unsupported favicon resolver")
_slots = threading.BoundedSemaphore(2)
_positive = FaviconCacheSQLite(FaviconCacheConfig(db_url="/var/lib/xtend-backend/favicon-positive.db", LIMIT_TOTAL_BYTES=64*1024*1024, HOLD_TIME=30*86400, BLOB_MAX_BYTES=65536, MAINTENANCE_PERIOD=60))
_negative = FaviconCacheSQLite(FaviconCacheConfig(db_url="/var/lib/xtend-backend/favicon-negative.db", HOLD_TIME=3600, LIMIT_TOTAL_BYTES=1024*1024, MAINTENANCE_PERIOD=60))

def available():
    return _enabled == "duckduckgo"

def cached(cache, domain, seconds):
    cache.maintenance()
    row = cache.DB.execute("SELECT m_time FROM blob_map WHERE resolver=? AND authority=?", ("duckduckgo", domain)).fetchone()
    if row and int(row[0]) > time.time()-seconds:
        return cache("duckduckgo", domain)
    return None

def handle(environ, start_response):
    def send(status, data=b"", mime="image/png"):
        start_response(status, [("Content-Type", mime), ("X-XTend-Favicon-Contract", "favicon-v1"), ("Cache-Control", "private, no-store"), ("X-Content-Type-Options", "nosniff")])
        return [data]
    if not available():
        return send("204 No Content")
    if environ.get("REQUEST_METHOD") != "GET":
        return send("405 Method Not Allowed")
    domain = parse_qs(environ.get("QUERY_STRING", "")).get("domain", [""])[0]
    if not re.fullmatch(r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}", domain):
        return send("400 Bad Request")
    hit = cached(_positive, domain, 30*86400)
    if hit and hit[0]:
        return send("200 OK", hit[0])
    if cached(_negative, domain, 3600) is not None:
        return send("204 No Content")
    if not _slots.acquire(blocking=False):
        return send("429 Too Many Requests")
    try:
        if os.environ.get("XTEND_TEST_FIXTURE") == "1":
            if domain.startswith("slow."):
                time.sleep(2)
                return send("204 No Content")
            if domain.startswith("missing."):
                data = None
            else:
                image = Image.new("RGBA", (32, 32), (12, 130, 170, 255))
                b = io.BytesIO()
                image.save(b, format="PNG")
                data = b.getvalue()
        else:
            data, _ = duckduckgo(domain, timeout=2)
        if not data or len(data) > 65536:
            _negative.set("duckduckgo", domain, None, None)
            return send("204 No Content")
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ("PNG", "JPEG", "ICO", "WEBP", "GIF") or max(image.size) > 512:
                raise ValueError("Unsupported icon")
            image.thumbnail((32, 32))
            output = io.BytesIO()
            image.convert("RGBA").save(output, format="PNG")
            data = output.getvalue()
        _positive.set("duckduckgo", domain, "image/png", data)
        return send("200 OK", data)
    except Exception:
        _negative.set("duckduckgo", domain, None, None)
        return send("204 No Content")
    finally:
        _slots.release()
