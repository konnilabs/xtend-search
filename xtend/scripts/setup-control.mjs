import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
const file=new URL('../../.env.control',import.meta.url);
if(fs.existsSync(file)){console.log('.env.control exists; kept unchanged.');process.exit();}
fs.writeFileSync(file,`# Local installation. This file contains secrets; never publish it.
PUBLIC_BASE_URL=http://localhost:8090
XTEND_PORT=8090
SEARXNG_BASE_URL=http://searxng:8082/
SEARXNG_TOKEN=${randomBytes(48).toString('base64url')}
NEXTCLOUD_BASE_URL=https://vm.ccs-networks.de/cloud/
NEXTCLOUD_CLIENT_ID=
NEXTCLOUD_CLIENT_SECRET=
NEXTCLOUD_INDEX_PHP=0
# Exact Nextcloud user IDs; roles: viewer, operator, administrator.
XTEND_ADMIN_ROLES='{}'
XTEND_PROBES=0
`,{mode:0o600});console.log('.env.control created; fill the Nextcloud client and role mapping.');
