import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../../server/control/store.mjs';
import {ControlPlane} from '../../server/control/plane.mjs';
import {validateQuery,retryAfter} from '../../server/control/contracts.mjs';
import {event} from '../../server/control/telemetry.mjs';
import {SearchExecutor} from '../../server/control/executor.mjs';
import {MediaProxy,publicAddress} from '../../server/control/media.mjs';
import {parseSearch} from '../../server/search.mjs';
import {sharedFamilyRepair} from '../../server/control/family-repair.mjs';
const admin={actor:'test-admin',role:'administrator'},operator={actor:'test-operator',role:'operator'},viewer={actor:'test-viewer',role:'viewer'};
const engine=id=>({id,capabilities:['general'],paging:true,safeSearch:true,language:true,languages:['de','en'],timeRange:true,timeout:5000,fingerprint:'fixture-contract'});
async function harness(ids=['one','two','three']){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'xsearch-control-')),store=new Store(directory),adapter={catalog:new Map(ids.map(id=>[id,engine(id)])),status:'compatible',lastRefresh:Date.now(),version:'fixture',async discover(){return this.catalog;}};
 const plane=new ControlPlane({store,adapter,probeEnabled:true});await plane.initialize();
 return {directory,store,plane,adapter,async close(){await plane.close();await fs.rm(directory,{recursive:true,force:true});}};
}
async function approve(h,id,patch={}){return h.plane.mutate('policy',{id,revision:h.plane.revision,reason:'initial_review',requestKey:randomUUID(),state:'allowed',rpm:20,concurrency:2,family:id,capabilities:['general'],pagingVerified:true,...patch},admin);}
const state={q:'open source',category:'general',language:'all',safeSearch:'1',timeRange:'',page:1,continuation:''};
test('reviewed defaults isolate unrelated providers while preserving sibling CAPTCHA restrictions',async()=>{
 const h=await harness(['duckduckgo','duckduckgo images','bing images','brave','unknown']);try{
  assert.equal(h.plane.policy('unknown').family,'');assert.equal(h.plane.policy('unknown').state,'disabled');
  for(const id of ['duckduckgo','duckduckgo images','bing images','brave'])await approve(h,id,{family:h.plane.policy(id).family});
  await h.plane.observe(h.adapter.catalog.get('duckduckgo'),state,{outcome:'error',errorClass:'captcha',durationMs:1,results:[]});
  assert.equal(h.plane.eligible(h.adapter.catalog.get('duckduckgo images'),state),'provider_family_cooldown');
  assert.equal(h.plane.eligible(h.adapter.catalog.get('bing images'),state),null);
  assert.equal(h.plane.eligible(h.adapter.catalog.get('brave'),state),null);
 }finally{await h.close();}
});
test('shared-default repair retains origin protection, quotas and approvals; refuses ambiguous or active state',async()=>{
 const h=await harness(['duckduckgo','bing','unknown']);try{
  for(const id of h.adapter.catalog.keys())await approve(h,id,{family:'shared'});
  const r=await h.plane.reserve(h.adapter.catalog.get('duckduckgo'),state);
  await h.plane.observe(h.adapter.catalog.get('duckduckgo'),state,{outcome:'error',errorClass:'captcha',durationMs:1,results:[]});
  await h.plane.telemetry.close();
  // The repair fixture models an incident with exact timestamp attribution.
  // Telemetry's real wall clock can tick between observe() and event creation.
  const attributeIncident=saved=>{const time=JSON.parse(saved.guards.find(r=>r.id==='health:duckduckgo:general').value).observedAt;for(const row of saved.events){const e=JSON.parse(row.value);if(e.data.engineId==='duckduckgo'&&e.data.errorClass==='captcha'){e.time=new Date(time).toISOString();row.value=JSON.stringify(e);}}return saved;};
  const active=attributeIncident(await h.store.call('load'));assert.throws(()=>sharedFamilyRepair(active,h.adapter.catalog),/Aktive/);
  r.release();await h.plane.serial;
  const saved=attributeIncident(await h.store.call('load')),before=JSON.stringify(saved),repair=sharedFamilyRepair(saved,h.adapter.catalog);
  assert.deepEqual(repair.changes.map(c=>[c.id,c.to]),[['duckduckgo','duckduckgo'],['bing','bing']]);
  const guards=new Map(repair.guards);assert.equal(guards.get('family:duckduckgo').blockedUntil,h.plane.buckets.get('family:shared').blockedUntil);
  assert.equal(guards.get('family:bing').blockedUntil,0);assert.equal(guards.get('family:bing').count,1);
  assert.equal(JSON.stringify(saved),before);
  assert.throws(()=>sharedFamilyRepair({...saved,events:[]},h.adapter.catalog),/eindeutig/);
 }finally{await h.close();}
});
test('unavailable search explains protection and unsupported filters without leaking admin state',async()=>{
 const h=await harness(['one','two']);try{
  const executor=new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture');
  assert.match((await executor.load(state,{})).errorMessage,/noch keine Quellen freigegeben/);
  await approve(h,'one');await approve(h,'two');
  h.adapter.catalog.get('one').safeSearch=false;
  const until=Date.now()+100000;h.plane.buckets.set('family:two',{blockedUntil:until});
  const data=await executor.load(state,{});assert.match(data.errorMessage,/SafeSearch/);assert.match(data.errorMessage,/Schutzfristen/);
  assert.ok(!data.errorMessage.includes(String(until)));assert.equal(h.plane.plan(state).length,0);
  h.plane.buckets.clear();h.adapter.execute=async()=>({outcome:'error',errorClass:'timeout',results:[],infoboxes:[],durationMs:1});
  assert.match((await executor.load(state,{})).errorMessage,/keine verwertbare Antwort/);
 }finally{await h.close();}
});
test('lexical query boundary rejects every upstream special parser prefix, preserves ordinary site syntax',()=>{
 for(const q of ['!google x','x !images','!!ddg x','!!',':de x','<1 x','x\u0085!g','x\u001c!g','!unknown x','x\u00a0!g'])assert.throws(()=>validateQuery(q));
 for(const q of ['open source','site:example.org fox','"!literal"','normal!word','a\u2003b'])assert.equal(validateQuery(q),q);
});
test('Retry-After accepts seconds and dates without shortening',()=>{const now=Date.now();assert.equal(retryAfter('3600',now),now+3600000);assert.ok(retryAfter(new Date(now+7200000).toUTCString(),now)>now+7190000);});
test('fresh catalog never auto-approves; policy changes preserve audit and revision',async()=>{const h=await harness();try{assert.equal(h.plane.plan(state).length,0);await approve(h,'one');assert.equal(h.plane.plan(state).length,1);assert.equal(h.plane.audit.length,1);assert.equal(h.plane.revision,1);}finally{await h.close();}});
test('roles and stale revisions reject without changing durable state',async()=>{const h=await harness();try{await assert.rejects(()=>h.plane.mutate('policy',{id:'one'},viewer),/Berechtigung/);await approve(h,'one');await assert.rejects(()=>approve(h,'two',{revision:0}),/zwischenzeitlich/);assert.equal(h.plane.revision,1);assert.equal(h.plane.policy('two').state,'disabled');}finally{await h.close();}});
test('idempotent commands create one revision and audit entry',async()=>{const h=await harness();try{const key=randomUUID();await approve(h,'one',{requestKey:key,revision:0});await approve(h,'one',{requestKey:key,revision:0});assert.equal(h.plane.audit.length,1);assert.equal(h.plane.revision,1);}finally{await h.close();}});
test('audit failure never confirms a mutation',async()=>{const h=await harness();try{const call=h.store.call.bind(h.store);h.store.call=(op,data)=>op==='mutation'?Promise.reject(new Error('disk_full')):call(op,data);await assert.rejects(()=>approve(h,'one'),/Audit/);assert.equal(h.plane.revision,0);assert.equal(h.plane.policy('one').state,'disabled');}finally{await h.close();}});
test('last budget token is reserved atomically across simultaneous requests',async()=>{const h=await harness();try{await approve(h,'one',{rpm:1});const e=h.adapter.catalog.get('one'),requests=await Promise.all(Array.from({length:10},()=>h.plane.reserve(e,state)));assert.equal(requests.filter(r=>r.release).length,1);requests.forEach(r=>r.release?.());}finally{await h.close();}});
test('engine selection honors every filter and changed capability fingerprints',async()=>{const h=await harness();try{await approve(h,'one');const e=h.adapter.catalog.get('one');e.safeSearch=false;assert.equal(h.plane.plan(state).length,0);e.safeSearch=true;e.fingerprint='changed';assert.equal(h.plane.plan(state).length,0);}finally{await h.close();}});
test('drain and provider deadlines are hard gates for manual probes',async()=>{const h=await harness();try{await approve(h,'one');const e=h.adapter.catalog.get('one'),health=h.plane.healthFor('one','general');health.providerRetryAfterAt=Date.now()+7200000;health.localBackoffUntil=Date.now()+60000;assert.equal((await h.plane.reserve(e,state,{probe:true})).reason,'cooldown');assert.equal(h.plane.next(health),health.providerRetryAfterAt);await h.plane.mutate('drain',{id:'one',minutes:15,revision:1,requestKey:randomUUID(),reason:'maintenance'},operator);assert.equal((await h.plane.reserve(e,state)).reason,'drained');}finally{await h.close();}});
test('backend failures do not label every provider unhealthy; empty results are not failures',async()=>{const h=await harness();try{const e=h.adapter.catalog.get('one');await h.plane.observe(e,state,{outcome:'error',errorClass:'backend_unavailable',results:[],durationMs:10});assert.equal(h.plane.healthFor('one','general').health,'unknown');assert.ok(h.plane.backendUntil>Date.now());await h.plane.observe(e,state,{outcome:'empty',errorClass:null,results:[],durationMs:2});assert.equal(h.plane.healthFor('one','general').consecutive,0);}finally{await h.close();}});
test('restart preserves quotas and policies, health becomes unknown',async()=>{const h=await harness();try{await approve(h,'one',{rpm:1});const r=await h.plane.reserve(h.adapter.catalog.get('one'),state);r.release();await h.plane.close();const store=new Store(h.directory),plane=new ControlPlane({store,adapter:h.adapter});await plane.initialize();h.store=store;h.plane=plane;assert.equal(plane.policy('one').state,'allowed');assert.equal((await plane.reserve(h.adapter.catalog.get('one'),state)).reason,'budget');}finally{await h.plane.close();await fs.rm(h.directory,{recursive:true,force:true});}});
test('event allowlist discards search contents, query hashes, IDs and arbitrary errors',()=>{const e=event('engine.observed',{engineId:'one',outcome:'success',durationMs:5,query:'PRIVATE_CANARY',queryHash:'PRIVATE_HASH',url:'https://private.test',userId:'private-user',error:'raw exception'});assert.ok(!JSON.stringify(e).includes('PRIVATE'));assert.ok(!JSON.stringify(e).includes('private'));assert.ok(!('query' in e.data));});
test('bounded telemetry reports drops while search state remains usable',async()=>{const h=await harness();try{h.plane.telemetry.writing=true;for(let i=0;i<500;i++)h.plane.telemetry.emit('engine.observed',{engineId:'one',outcome:'success'});assert.equal(h.plane.telemetry.queue.length,256);assert.ok(h.plane.telemetry.dropped>=244);h.plane.telemetry.writing=false;}finally{await h.close();}});
test('media addresses exclude local, private, mapped and metadata networks',()=>{for(const ip of ['127.0.0.1','10.0.1.1','169.254.169.254','192.168.1.1','172.16.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1'])assert.equal(publicAddress(ip),false,ip);assert.equal(publicAddress('8.8.8.8'),true);});
test('early engine batches, stable append, dedupe, signed paging and post-plan disable',async()=>{const h=await harness();try{
 for(const id of h.adapter.catalog.keys())await approve(h,id);
 h.adapter.execute=async(e,s,signal)=>{await new Promise(resolve=>setTimeout(resolve,({one:50,two:200,three:450})[e.id]));return {outcome:'success',errorClass:null,durationMs:5,results:[{url:'https://example.org/shared',title:'Shared',engines:[e.id]},{url:`https://example.org/${e.id}`,title:e.id,engines:[e.id]}],infoboxes:[]};};
 const executor=new SearchExecutor(h.plane,new MediaProxy('fixture-key'),'fixture-key'),start=performance.now(),batches=[];
 for await(const f of executor.run(state,{signal:new AbortController().signal})){batches.push(f);if(f.event==='results.batch'&&batches.filter(b=>b.event==='results.batch').length===1)assert.ok(performance.now()-start<350);}
 const resultBatches=batches.filter(b=>b.event==='results.batch');assert.equal(resultBatches[0].data.results.length,2);const stable=r=>{const {sourceLabel,metadata,...rest}=r;return rest;};for(let i=1;i<resultBatches.length;i++)assert.deepEqual(resultBatches[i].data.results.slice(0,resultBatches[i-1].data.results.length).map(stable),resultBatches[i-1].data.results.map(stable));
 const final=batches.at(-1).data;assert.equal(final.results.length,4);const next=parseSearch(new URL(final.pages.find(p=>p.id==='next').url,'http://localhost'));assert.deepEqual(executor.continuation(next).sort(),['one','three','two']);assert.throws(()=>executor.continuation({...next,q:'different'}));assert.throws(()=>executor.continuation({...next,continuation:next.continuation+'x'}));const second=await executor.load(next,{});assert.equal(new Set(second.pages.map(p=>p.id)).size,second.pages.length);assert.equal(second.pages.filter(p=>p.id==='previous').length,1);await approve(h,'one',{state:'disabled'});assert.ok(!h.plane.plan(next,executor.continuation(next)).some(e=>e.id==='one'));
 }finally{await h.close();}});
test('an idempotency key cannot authorize a different command',async()=>{const h=await harness();try{const key=randomUUID();await approve(h,'one',{requestKey:key,revision:0});await assert.rejects(()=>approve(h,'two',{requestKey:key,revision:0}),/zwischenzeitlich/);assert.equal(h.plane.policy('two').state,'disabled');}finally{await h.close();}});
test('provider family cooldown blocks sibling engines and probes and survives restart',async()=>{const h=await harness();try{for(const id of ['one','two'])await approve(h,id,{family:'shared-provider'});await h.plane.observe(h.adapter.catalog.get('one'),state,{outcome:'error',errorClass:'rate_limit',retryNotBefore:Date.now()+7200000,results:[],durationMs:1});assert.equal((await h.plane.reserve(h.adapter.catalog.get('two'),state,{probe:true})).reason,'provider_family_cooldown');await h.plane.close();h.store=new Store(h.directory);h.plane=new ControlPlane({store:h.store,adapter:h.adapter});await h.plane.initialize();assert.equal((await h.plane.reserve(h.adapter.catalog.get('two'),state)).reason,'provider_family_cooldown');}finally{await h.plane.close();await fs.rm(h.directory,{recursive:true,force:true});}});
test('technical quarantine recovery is audited and cannot shorten provider deadlines',async()=>{const h=await harness();try{await approve(h,'one');const e=h.adapter.catalog.get('one');await h.plane.observe(e,state,{outcome:'error',errorClass:'schema_invalid',results:[],durationMs:1});const h0=h.plane.healthFor('one','general');h0.providerRetryAfterAt=Date.now()+7200000;await approve(h,'one',{quarantine:false,reason:'recovery_review'});const recovered=h.plane.healthFor('one','general');assert.equal(recovered.quarantine,null);assert.equal(recovered.breaker,'open');assert.equal(recovered.providerRetryAfterAt,h0.providerRetryAfterAt);assert.equal((await h.plane.reserve(e,state,{probe:true})).reason,'cooldown');}finally{await h.close();}});

test('knowledge preserves one attributed entity, rejects ambiguity and never weakens filters',async()=>{
 const h=await harness(['knowledge']);try{
  const e=h.adapter.catalog.get('knowledge');e.capabilities=['knowledge'];e.safeSearch=true;
  await approve(h,e.id,{capabilities:['knowledge']});
  const boxes=[{infobox:'Entity A',content:'Verified fixture',urls:[{url:'https://example.org/entity-a',title:'Original'}]}];
  h.adapter.execute=async()=>({outcome:'success',results:[],infoboxes:boxes,durationMs:1});
  const executor=new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture');
  const one=await executor.load(state,{});assert.equal(one.knowledgeStatus,'available');assert.equal(one.knowledgeCards[0].title,'Entity A');
  boxes.push({infobox:'Entity B',urls:[{url:'https://example.org/entity-b'}]});
  const ambiguous=await executor.load(state,{});assert.equal(ambiguous.knowledgeStatus,'ambiguous');assert.equal(ambiguous.knowledgeCards.length,0);assert.equal(ambiguous.statusLabel,'0 von 1 Quellen mit Treffern');
  e.safeSearch=false;const filtered=await executor.load(state,{});assert.equal(filtered.knowledgeStatus,'not_applicable');assert.equal(filtered.knowledgeCards.length,0);
 }finally{await h.close();}
});
test('knowledge rate-limit fallback cannot reuse the same quota domain',async()=>{
 const h=await harness(['alpha','beta','gamma']),calls=[];try{
  for(const e of h.adapter.catalog.values()){e.capabilities=['knowledge'];await approve(h,e.id,{capabilities:['knowledge'],family:e.id==='gamma'?'other':'shared-family'});}
  h.adapter.execute=async e=>{calls.push(e.id);return e.id==='alpha'?{outcome:'error',errorClass:'rate_limit',results:[],infoboxes:[],durationMs:1}:{outcome:'success',results:[],infoboxes:[{infobox:'Independent source entity',urls:[{url:'https://example.org/entity'}]}],durationMs:1};};
  const data=await new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').load(state,{});
  assert.deepEqual(calls,['alpha','gamma']);assert.equal(data.knowledgeStatus,'available');
 }finally{await h.close();}
});
test('no suitable sources and all-engine failures have honest terminal states',async()=>{
 const h=await harness(['one']);try{
  let calls=0;h.adapter.execute=async()=>{calls++;return {outcome:'error',errorClass:'timeout',results:[],infoboxes:[],durationMs:1};};
  const executor=new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture');
  assert.equal((await executor.load(state,{})).error,true);assert.equal(calls,0);
  await approve(h,'one');assert.equal((await executor.load(state,{})).error,true);assert.equal(calls,1);
 }finally{await h.close();}
});
test('client cancellation stops commits and retains dispatched cost and concurrency leases across restart',async()=>{
 const h=await harness(['one']);try{
  await approve(h,'one',{concurrency:1});const controller=new AbortController();let calls=0;
  h.adapter.execute=async(e,s,signal)=>{calls++;controller.abort();return {outcome:'cancelled',errorClass:'timeout',results:[],infoboxes:[],durationMs:1};};
  const frames=[];for await(const f of new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').run(state,{signal:controller.signal}))frames.push(f);
  assert.equal(calls,1);assert.equal(frames.length,1);assert.equal(h.plane.buckets.get('engine:one').count,1);
  await h.plane.close();h.store=new Store(h.directory);h.plane=new ControlPlane({store:h.store,adapter:h.adapter});await h.plane.initialize();
  assert.equal((await h.plane.reserve(h.adapter.catalog.get('one'),state)).reason,'budget');
 }finally{await h.plane.close();await fs.rm(h.directory,{recursive:true,force:true});}
});
test('corrupt storage is fail-closed and does not recreate approvals',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xsearch-corrupt-'));await fs.writeFile(path.join(dir,'control-plane.sqlite'),'corrupt fixture');const store=new Store(dir),adapter={catalog:new Map([['one',engine('one')]]),status:'compatible',lastRefresh:Date.now(),discover:async()=>{}};const plane=new ControlPlane({store,adapter});
 try{await plane.initialize();assert.equal(plane.storeOK,false);assert.equal(plane.plan(state).length,0);}finally{await plane.close().catch(()=>{});await fs.rm(dir,{recursive:true,force:true});}
});
test('special IPv6 representations and transition ranges cannot bypass the media boundary',()=>{
 for(const ip of ['2001:0db8::1','2001:0000::1','2001:0001::1','2002:7f00:1::1','3fff::1'])assert.equal(publicAddress(ip),false,ip);
 assert.equal(publicAddress('2001:4860:4860::8888'),true);
});
test('a real SQLite audit insert failure rolls back policy and revision atomically',async()=>{
 const h=await harness(['one']);try{
  const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(path.join(h.directory,'control-plane.sqlite'));
  db.exec("PRAGMA busy_timeout=1500; CREATE TRIGGER fail_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT, 'test storage failure'); END;");
  await assert.rejects(()=>approve(h,'one'),/Audit/);
  const durable=await h.store.call('load');assert.equal(durable.meta.revision,0);assert.equal(durable.policies.length,0);assert.equal(durable.audit.length,0);db.close();
 }finally{await h.close();}
});

test('SafeSearch exception is explicit, durable and audited, without relaxing other eligibility guards',async()=>{
 const h=await harness(['wikipedia']);try{
  const e=h.adapter.catalog.get('wikipedia');e.safeSearch=false;
  assert.equal(h.plane.policy(e.id).safeSearchBypass,false);
  await approve(h,e.id,{family:'wikimedia'});assert.equal(h.plane.eligible(e,state),'safesearch');
  await assert.rejects(()=>approve(h,e.id,{family:'wikimedia',safeSearchBypass:'true'}),/Wahrheitswert/);
  await approve(h,e.id,{family:'wikimedia',safeSearchBypass:true});assert.equal(h.plane.eligible(e,state),null);
  const stored=await h.store.call('load');assert.equal(JSON.parse(stored.policies[0].value).safeSearchBypass,true);assert.equal(stored.audit.length,2);
  const r=await h.plane.reserve(e,state);assert.equal(r.safeSearchBypassed,true);r.release();await h.plane.serial;
  e.language=false;assert.equal(h.plane.eligible(e,{...state,language:'de'}),'language');
  e.timeRange=false;assert.equal(h.plane.eligible(e,{...state,timeRange:'day'}),'time_range');
  e.paging=false;assert.equal(h.plane.eligible(e,{...state,page:2}),'paging');
  h.plane.buckets.set('family:wikimedia',{blockedUntil:Date.now()+60000});assert.equal(h.plane.eligible(e,state),'provider_family_cooldown');h.plane.buckets.clear();
  await approve(h,e.id,{family:'wikimedia',safeSearchBypass:false});assert.equal(h.plane.eligible(e,state),'safesearch');
 }finally{await h.close();}
});
test('knowledge exception changes only its own dispatch, preserves native SafeSearch and discloses the exception in SSR and streaming',async()=>{
 const h=await harness(['web','wikipedia']);try{
  const wiki=h.adapter.catalog.get('wikipedia');wiki.safeSearch=false;wiki.capabilities=['knowledge'];
  await approve(h,'web',{safeSearchBypass:true});await approve(h,'wikipedia',{family:'wikimedia',capabilities:['knowledge'],safeSearchBypass:true});
  const calls=[];h.adapter.execute=async(e,s)=>{calls.push([e.id,s.safeSearch]);return {outcome:'success',durationMs:1,results:e.id==='web'?[{url:'https://example.org',title:'Web',engines:['web']}]:[],infoboxes:e.id==='wikipedia'?[{infobox:'Ubuntu',content:'Knowledge fixture',urls:[{url:'https://en.wikipedia.org/wiki/Ubuntu',title:'Wikipedia'}]}]:[]};};
  const before=JSON.stringify(state),frames=[];for await(const frame of new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').run(state,{}))frames.push(frame);
  assert.equal(JSON.stringify(state),before);assert.deepEqual(calls.sort(),[['web','1'],['wikipedia','0']]);
  const result=frames.at(-1).data;assert.equal(result.safeSearch,'1');assert.equal(result.knowledgeCards.length,1);assert.equal(result.showKnowledge,true);
  assert.equal(result.warnings.length,1);assert.match(result.warnings[0].message,/wikipedia.*ohne SafeSearch/);
  assert.ok(frames.some(f=>f.event==='knowledge.updated'&&f.data.knowledgeCards.length===1));
  const off=await new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').load({...state,safeSearch:'0'},{});assert.equal(off.warnings.length,0);
 }finally{await h.close();}
});

test('duplicate web hits retain every contributing source across incremental frames without moving the row',async()=>{
 const h=await harness();try{
  for(const id of h.adapter.catalog.keys())await approve(h,id);
  h.adapter.execute=async e=>{await new Promise(r=>setTimeout(r,{one:15,two:60,three:100}[e.id]));return {outcome:'success',durationMs:1,results:[{url:'https://example.org/shared?utm_source='+e.id+'#fragment',title:e.id,engines:[e.id]}],infoboxes:[]};};
  const frames=[];for await(const f of new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').run({...state,q:'GNU/ Linux',language:'en',safeSearch:'0'},{}))frames.push(f);
  const batches=frames.filter(f=>f.event==='results.batch');assert.equal(batches.length,3);
  for(const batch of batches){assert.equal(batch.data.results.length,1);assert.equal(batch.data.results[0].id,batches[0].data.results[0].id);assert.equal(batch.data.results[0].title,'one');}
  assert.equal(batches[0].data.results[0].sourceLabel,'one');assert.deepEqual(batches[1].data.results[0].sourceLabel.split(' · ').sort(),['one','two']);assert.deepEqual(frames.at(-1).data.results[0].sourceLabel.split(' · ').sort(),['one','three','two']);
  assert.equal(frames.at(-1).data.statusLabel,'3 von 3 Quellen mit Treffern');assert.equal(frames.at(-1).data.results[0].url,'https://example.org/shared');
 }finally{await h.close();}
});
test('partial web success identifies failed sources and later provider exclusions without counting them as contributors',async()=>{
 const h=await harness(['one','two','three','private-disabled']);try{
  for(const id of ['one','two','three'])await approve(h,id);
  h.adapter.execute=async e=>e.id==='three'?{outcome:'success',durationMs:1,results:[{url:'https://example.org',title:'Available',engines:[e.id]}],infoboxes:[]}:{outcome:'error',durationMs:1,errorClass:e.id==='one'?'captcha':'access_denied',results:[],infoboxes:[]};
  const executor=new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture'),data=await executor.load({...state,language:'en',safeSearch:'0'},{});
  assert.equal(data.statusLabel,'1 von 3 Quellen mit Treffern · 2 fehlgeschlagen');assert.equal(data.error,false);assert.equal(data.results.length,1);
  assert.ok(data.warnings.some(w=>/one:.*CAPTCHA/.test(w.message)));assert.ok(data.warnings.some(w=>/two:.*verweigert/.test(w.message)));
  const next=await executor.load(state,{});assert.equal(next.statusLabel,'1 von 1 Quellen mit Treffern · 2 weitere nicht berücksichtigt');assert.equal(next.warnings.length,2);assert.ok(next.warnings.every(w=>/Anbietergruppe pausiert/.test(w.message)));assert.ok(!JSON.stringify(next.warnings).includes('private-disabled'));
 }finally{await h.close();}
});
test('reserved budget failures are not successes; source explanations never expose raw backend errors',async()=>{
 const {sourceFailureMessage}=await import('../../server/control/source-messages.mjs');assert.equal(sourceFailureMessage('one','private-token-and-url'),'one: Die Quelle meldet einen Fehler.');assert.equal(sourceFailureMessage('one','__proto__'),'one: Die Quelle meldet einen Fehler.');
 const h=await harness(['one']);try{
  await approve(h,'one',{rpm:1});const r=await h.plane.reserve(h.adapter.catalog.get('one'),state);r.release();await h.plane.serial;
  h.adapter.execute=async()=>assert.fail('Must not dispatch a source without budget');
  const data=await new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').load(state,{});assert.equal(data.statusLabel,'0 von 1 Quellen mit Treffern · 1 nicht ausgeführt');assert.equal(data.error,true);assert.match(data.warnings[0].message,/one:.*Suchbudget/);
 }finally{await h.close();}
});

test('Wikipedia and Wikidata cannot consume web slots; knowledge remains separately and explicitly approved',async()=>{
 const h=await harness(['alpha','wikidata','wikipedia','yahoo','zeta']),calls=[];try{
  for(const e of h.adapter.catalog.values()){
   if(['wikipedia','wikidata'].includes(e.id)){e.knowledge=true;e.capabilities=['general','knowledge'];await approve(h,e.id,{family:'wikimedia',capabilities:['general','knowledge']});}
   else await approve(h,e.id);
  }
  h.adapter.execute=async(e,s)=>{calls.push([e.id,s.category]);return {outcome:'success',durationMs:1,results:e.knowledge?[]:[{url:'https://example.org/'+e.id,title:e.id,engines:[e.id]}],infoboxes:e.knowledge?[{infobox:'GNU',content:'Fixture entity',urls:[{url:'https://example.org/gnu',title:'Original'}]}]:[]};};
  assert.deepEqual(h.plane.plan({...state,language:'en',safeSearch:'0'}).map(e=>e.id),['alpha','yahoo','zeta']);
  const executor=new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture'),data=await executor.load({...state,q:'GNU/ Linux',language:'en',safeSearch:'0'},{});
  assert.equal(data.results.length,3);assert.equal(data.knowledgeCards.length,1);assert.deepEqual(calls.sort(),[['alpha','general'],['wikidata','knowledge'],['yahoo','general'],['zeta','general']]);assert.equal(data.statusLabel,'4 von 4 Quellen mit Treffern');
  for(const id of ['wikidata','wikipedia'])await approve(h,id,{family:'wikimedia',capabilities:['general']});calls.length=0;
  const noGrant=await executor.load(state,{});assert.equal(noGrant.results.length,3);assert.equal(noGrant.knowledgeCards.length,0);assert.equal(calls.some(([id])=>['wikidata','wikipedia'].includes(id)),false);
 }finally{await h.close();}
});
