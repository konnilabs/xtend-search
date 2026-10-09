"""Exercise the shipped Portainer Compose without live secrets or data volumes."""
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

root = Path(__file__).resolve().parents[3]
version = json.loads((root / 'xtend/package.json').read_text())['version']
project = 'xtend-release-smoke-' + version.replace('.', '')
port = int(os.environ.get('SMOKE_PORT', '8104'))
env = dict(os.environ, PUBLIC_BASE_URL=f'http://localhost:{port}', XTEND_PORT=str(port),
           SEARXNG_TOKEN='release-smoke-test-only', NEXTCLOUD_CLIENT_ID='release-smoke', NEXTCLOUD_CLIENT_SECRET='release-smoke-test-only',
           XTEND_ADMIN_ROLES='{}', XTEND_SEARCH_IMAGE=f'xtend-search:{version}',
           XTEND_BACKEND_IMAGE=f'xtend-search-searxng:{version}',
           XTEND_CONTROL_VOLUME=project+'-control', XTEND_BACKEND_VOLUME=project+'-backend',
           XTEND_EVIDENCE_VOLUME=project+'-evidence', XTEND_FAVICON_RESOLVER='off')
compose = ['docker', 'compose', '--project-name', project, '-f', str(root / 'compose.portainer.yml')]
try:
    subprocess.run(compose + ['up', '-d', '--no-build'], cwd=root, env=env, check=True)
    for _ in range(60):
        try:
            with urllib.request.urlopen(f'http://localhost:{port}/health/ready', timeout=2) as response:
                health = json.load(response)
            if health.get('ok'):
                break
        except (OSError, ValueError):
            pass
        time.sleep(1)
    else:
        raise RuntimeError('Portainer stack did not become ready')
    assert health['version'] == version and health['retrieval'] == 'compatible' and health['storage'] == 'ready', health
    report = dict(ok=True, health=health, configuration='Portainer Compose; isolated disposable volumes and synthetic credentials; no live SSO')
    (root / f'xtend/evidence/control-plane/release-{version}-portainer-smoke.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
finally:
    subprocess.run(compose + ['down', '-v'], cwd=root, env=env, check=True)
