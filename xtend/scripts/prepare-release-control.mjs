import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const target=path.resolve('.env.control');
if(fs.existsSync(target)){console.log('.env.control vorhanden; unverändert beibehalten.');process.exit();}
fs.writeFileSync(target,`# Geschützte lokale Konfiguration. Nicht veröffentlichen.
PUBLIC_BASE_URL=http://localhost:8090
XTEND_BIND_IP=127.0.0.1
XTEND_PORT=8090
SEARXNG_BASE_URL=http://searxng:8082/
SEARXNG_TOKEN=${randomBytes(48).toString('base64url')}
NEXTCLOUD_BASE_URL=https://vm.ccs-networks.de/cloud/
NEXTCLOUD_CLIENT_ID=
NEXTCLOUD_CLIENT_SECRET=
NEXTCLOUD_INDEX_PHP=0
XTEND_ADMIN_ROLES='{}'
XTEND_PROBES=0
XTEND_ADMIN_MUTATIONS=1
XTEND_STREAMING=1
XTEND_KNOWLEDGE=1
`,{mode:0o600,flag:'wx'});
console.log('.env.control angelegt. Nextcloud-Client und Rollenfreigaben gemäß INSTALLATION.md eintragen.');
