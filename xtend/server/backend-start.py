"""Set a private runtime secret, then exec the upstream WSGI server."""
import os
from pathlib import Path
import secrets
path = Path('/var/lib/xtend-backend/core-secret')
if not path.exists():
    path.write_text(secrets.token_hex(48))
    path.chmod(0o600)
os.environ['SEARXNG_SECRET'] = path.read_text().strip()
os.execvp('python', ['python', '-m', 'granian', '--interface', 'wsgi', '--host', '0.0.0.0', '--port', '8082', '--workers', '1', '--blocking-threads', '8', '--backpressure', '32', 'xtend.server.backend:application'])
