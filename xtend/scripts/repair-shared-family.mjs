// Run with the search service stopped, under its owner.lock; dry-run by default.
// Uses the normal validated, revision-bound, audited policy mutation path.
import {DatabaseSync,backup} from 'node:sqlite';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/control/store.mjs';
import {SearxAdapter} from '../server/control/adapter.mjs';
import {ControlPlane} from '../server/control/plane.mjs';
import {sharedFamilyRepair} from '../server/control/family-repair.mjs';
const apply=process.argv.includes('--apply');
process.umask(0o077);
const directory=process.env.XTEND_DATA_DIR;
if(!directory)throw new Error('XTEND_DATA_DIR required');
const db=new DatabaseSync(path.join(directory,'control-plane.sqlite'),{readOnly:true});
const state={meta:db.prepare('select revision,mode from metadata').get(),policies:db.prepare('select id,value from policies').all(),guards:db.prepare('select id,value from guards').all(),events:db.prepare('select value from events order by seq desc limit 1000').all(),audit:[],aggregates:[]};
const adapter=new SearxAdapter({baseUrl:process.env.SEARXNG_BASE_URL,token:process.env.SEARXNG_TOKEN});await adapter.discover();
const plan=sharedFamilyRepair(state,adapter.catalog);
console.log(JSON.stringify({mode:apply?'apply':'preview',...plan},null,2));
if(!apply){db.close();process.exit(0);}
const expected=process.argv.find(a=>a.startsWith('--revision='))?.split('=')[1];
if(String(plan.revision)!==expected)throw new Error('Revision differs from reviewed repair plan');
await backup(db,path.join(directory,`before-family-repair-${plan.revision}.sqlite`));db.close();
const store=new Store(directory),plane=new ControlPlane({store,adapter});
try{
 const fresh=await store.call('load');if(fresh.meta.revision!==plan.revision)throw new Error('Concurrent policy update');
 plane.adopt(fresh);plane.storeOK=true;
 // Persist origin protection before moving any source; partial failures remain safe.
 await store.call('guards',plan.guards);for(const [id,g]of plan.guards)plane.buckets.set(id,g);
 for(const change of plan.changes){
  const policy=plane.policy(change.id);
  await plane.mutate('policy',{...policy,id:change.id,family:change.to,revision:plane.revision,reason:'maintenance',requestKey:randomUUID()},{actor:'maintenance:shared-family-repair',role:'administrator'});
 }
 console.log(JSON.stringify({applied:plan.changes.length,revision:plane.revision,duckduckgoBlockedUntil:plan.preservedDuckDuckGoUntil}));
}finally{await plane.close();}
