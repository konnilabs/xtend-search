// Explicit, revision-bound maintenance review. Stop search and hold owner.lock
// for --apply. No automatic approvals at startup; dry-run is read-only.
import {DatabaseSync,backup} from 'node:sqlite';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/control/store.mjs';
import {SearxAdapter} from '../server/control/adapter.mjs';
import {ControlPlane} from '../server/control/plane.mjs';
import {localeCatalogRepair} from '../server/control/locales.mjs';
import {secret} from '../server/control/auth.mjs';
process.umask(0o077);
const directory=process.env.XTEND_DATA_DIR;if(!directory)throw new Error('XTEND_DATA_DIR required');
const db=new DatabaseSync(path.join(directory,'control-plane.sqlite'),{readOnly:true});
const state={meta:db.prepare('SELECT revision,mode FROM metadata WHERE id=1').get(),policies:db.prepare('SELECT id,value FROM policies').all()};
const adapter=new SearxAdapter({baseUrl:process.env.SEARXNG_BASE_URL,token:secret('SEARXNG_TOKEN')});await adapter.discover();
const plan=localeCatalogRepair(state,adapter.catalog),apply=process.argv.includes('--apply');
console.log(JSON.stringify({mode:apply?'apply':'preview',...plan},null,2));
if(!apply||!plan.changes.length){db.close();process.exit(0);}
const revision=process.argv.find(a=>a.startsWith('--revision='))?.split('=')[1];
if(String(plan.revision)!==revision)throw new Error('Revision differs from reviewed repair plan');
await backup(db,path.join(directory,`before-locale-repair-${plan.revision}.sqlite`));db.close();
const store=new Store(directory),plane=new ControlPlane({store,adapter});
try{
 const fresh=await store.call('load');if(fresh.meta.revision!==plan.revision)throw new Error('Concurrent policy update');
 plane.adopt(fresh);plane.storeOK=true;
 for(const {id}of plan.changes)await plane.mutate('policy',{...plane.policy(id),id,revision:plane.revision,reason:'maintenance',requestKey:randomUUID()},{actor:'maintenance:locale-catalog-repair',role:'administrator'});
 console.log(JSON.stringify({applied:plan.changes.length,revision:plane.revision}));
}finally{await plane.close();}
