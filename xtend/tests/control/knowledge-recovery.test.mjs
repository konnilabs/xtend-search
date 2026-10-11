import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {Store} from '../../server/control/store.mjs';import {ControlPlane} from '../../server/control/plane.mjs';import {SearchExecutor} from '../../server/control/executor.mjs';import {MediaProxy} from '../../server/control/media.mjs';import {event} from '../../server/control/telemetry.mjs';
const state={q:'GNU/ Linux',category:'general',language:'en',safeSearch:'1',timeRange:'',page:1,continuation:''},admin={actor:'fixture-admin',role:'administrator'};
const engine=(id,capabilities=['general'])=>({id,capabilities,paging:true,safeSearch:true,language:true,languages:['en','de'],timeRange:true,timeout:1000,fingerprint:'test-'+id,knowledge:capabilities.includes('knowledge')});
async function harness(records=[engine('source')]){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'xsearch-v05-')),store=new Store(directory),adapter={catalog:new Map(records.map(e=>[e.id,e])),nativeScopes:new Map(),status:'compatible',lastRefresh:Date.now(),version:'fixture',instanceId:'fixture',async discover(){return this.catalog;}};
 const plane=new ControlPlane({store,adapter,probeEnabled:false});await plane.initialize();plane.demandRecovery=true;
 const grant=async(id,patch={})=>plane.mutate('policy',{id,revision:plane.revision,reason:'initial_review',requestKey:randomUUID(),state:'allowed',rpm:60,concurrency:4,family:id.replaceAll(' ','-'),capabilities:adapter.catalog.get(id).capabilities,pagingVerified:true,...patch},admin);
 return {directory,store,adapter,plane,grant,async close(){await plane.close();await fs.rm(directory,{recursive:true,force:true});}};
}
const box={infobox:'GNU/Linux',content:'Fixture knowledge',urls:[{url:'https://example.org/gnu',title:'Original'}]};
test('demand recovery at expired deadlines permits one atomic lease with probes disabled; empty is reachable',async()=>{
 const h=await harness();try{await h.grant('source');const e=h.adapter.catalog.get('source'),health=h.plane.healthFor(e.id,'general');health.breaker='open';health.observedAt=Date.now()-1000;
 const [a,b]=await Promise.all([h.plane.reserve(e,state),h.plane.reserve(e,state)]);assert.equal(a.recovering,true);assert.equal(b.reason,'watch_required');const stored=await h.store.call('load');assert.equal(JSON.parse(stored.guards.find(g=>g.id==='health:source:general').value).breaker,'half_open');
 await h.plane.observe(e,state,{outcome:'empty',errorClass:null,results:[],infoboxes:[],durationMs:1});a.release();assert.equal(health.breaker,'closed');assert.equal(health.health,'healthy');assert.equal(h.plane.eligible(e,state),null);
 }finally{await h.close();}
});
test('cancelled trial returns to open; a persisted half-open lease expires across an actual storage restart',async()=>{
 const h=await harness(),realNow=Date.now;let restarted;
 try{await h.grant('source');const e=h.adapter.catalog.get('source'),health=h.plane.healthFor(e.id,'general');health.breaker='open';const a=await h.plane.reserve(e,state);await h.plane.observe(e,state,{outcome:'cancelled',durationMs:1});a.release();await h.plane.serial;assert.equal(health.breaker,'open');
 const b=await h.plane.reserve(e,state);assert(b.recovering);await h.plane.close();
 restarted=new ControlPlane({store:new Store(h.directory),adapter:h.adapter,probeEnabled:false});await restarted.initialize();restarted.demandRecovery=true;
 assert.equal(restarted.eligible(e,state),'watch_required');Date.now=()=>realNow()+3000;const c=await restarted.reserve(e,state);assert.equal(c.recovering,true);await restarted.observe(e,state,{outcome:'empty',results:[],durationMs:1});c.release();assert.equal(restarted.healthFor(e.id,'general').breaker,'closed');
 }finally{Date.now=realNow;await restarted?.close();await fs.rm(h.directory,{recursive:true,force:true});}
});
test('native suspension duration replaces new CAPTCHA estimate while preserving stored and Retry-After limits',async()=>{
 const h=await harness([engine('source'),engine('sibling')]);try{await h.grant('source');await h.grant('sibling');const e=h.adapter.catalog.get('source'),scope='a'.repeat(32),until=Date.now()+60000;h.adapter.nativeScopes.set('sibling',scope);
 await h.plane.observe(e,state,{outcome:'error',errorClass:'captcha',durationMs:1,results:[],nativeHealth:{scope,remainingMs:60000},backendSuspendedUntil:until});const health=h.plane.healthFor(e.id,'general');assert.equal(health.deadlineSource,'native');assert(health.localBackoffUntil<until);assert.equal(h.plane.next(health),until);assert.equal(h.plane.eligible(h.adapter.catalog.get('sibling'),state),'backend_suspended');
 health.localBackoffUntil=Date.now()+15*86400000;health.deadlineSource='legacy_estimate';const legacy=health.localBackoffUntil;await h.plane.observe(e,state,{outcome:'error',errorClass:'captcha',durationMs:1,results:[],nativeHealth:{scope,remainingMs:1000},backendSuspendedUntil:Date.now()+1000,retryNotBefore:Date.now()+20*86400000});assert.equal(health.localBackoffUntil,legacy);assert.equal(health.deadlineSource,'legacy_estimate');assert(h.plane.next(health)>legacy);
 }finally{await h.close();}
});
test('legacy CAPTCHA estimates, administrative quarantine and capability quality pauses remain protective',async()=>{
 const h=await harness([engine('source',['general','images'])]);try{await h.grant('source');const e=h.adapter.catalog.get('source');await h.plane.observe(e,state,{outcome:'error',errorClass:'captcha',results:[],durationMs:1});assert(h.plane.next(h.plane.healthFor(e.id,'general'))>=Date.now()+14*86400000);assert.equal(h.plane.healthFor(e.id,'general').deadlineSource,'legacy_estimate');
 h.plane.buckets.get('family:source').blockedUntil=0;h.plane.healthFor(e.id,'general').localBackoffUntil=0;h.plane.quality={blocked:(_id,cap)=>cap==='images',adopt(){}};assert.equal(h.plane.eligible(e,state),null);assert.equal(h.plane.eligible(e,{...state,category:'images'}),'quality_cooldown');await h.grant('source',{quarantine:true});assert.equal(h.plane.eligible(e,state),'quarantine');
 }finally{await h.close();}
});
test('knowledge fallback handles empty, ambiguous and timeout without consuming the three web slots',async()=>{
 for(const first of ['empty','ambiguous','timeout']){
 const h=await harness([engine('a'),engine('b'),engine('c'),engine('wikidata',['general','knowledge']),engine('wikipedia',['general','knowledge'])]),calls=[];try{
  for(const e of h.adapter.catalog.values())await h.grant(e.id,{family:e.knowledge?'wikimedia':e.id});
  h.adapter.execute=async(e,s)=>{calls.push([e.id,s.category]);if(!e.knowledge)return {outcome:'success',errorClass:null,durationMs:1,results:[{url:'https://example.org/'+e.id,title:e.id}],infoboxes:[]};if(e.id==='wikidata')return first==='timeout'?{outcome:'error',errorClass:'timeout',results:[],durationMs:1}: {outcome:first==='empty'?'empty':'success',errorClass:null,durationMs:1,results:[],infoboxes:first==='empty'?[]:[box,{...box,infobox:'Other'}]};return {outcome:'success',errorClass:null,durationMs:1,results:[{url:'https://example.org/ancillary',title:'Ancillary'}],infoboxes:[box]};};
  const data=await new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').load(state,{});assert.equal(data.results.length,3);assert.equal(data.knowledgeCards.length,1);assert.equal(data.knowledgeCardCount,1);assert.equal(calls.length,5);assert.equal(data.results.some(r=>r.title==='Ancillary'),false);
 }finally{await h.close();}}
});
test('knowledge sources rotate between families, respect shared bans and treat the period only as context',async()=>{
 const ddg=engine('ddg definitions',['knowledge']);ddg.knowledgeLanguage='english';ddg.language=false;ddg.languages=[];ddg.timeRange=false;
 const h=await harness([ddg,engine('wikidata',['knowledge']),engine('wikipedia',['knowledge'])]);try{
  for(const e of h.adapter.catalog.values())await h.grant(e.id,{family:e.id==='ddg definitions'?'duckduckgo':'wikimedia'});
  const seen=[];for(let i=0;i<6;i++)seen.push(h.plane.knowledgePlan({...state,category:'knowledge'})[0].id);assert.equal(seen.filter(x=>x==='ddg definitions').length,3);assert(seen.includes('wikipedia'));assert(seen.includes('wikidata'));assert.equal(h.plane.eligible(ddg,{...state,category:'knowledge',language:'de'}),'language');
  h.adapter.execute=async(e,s)=>{assert.equal(s.timeRange,'');return {outcome:'success',results:[],infoboxes:[box],durationMs:1};};const data=await new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').load({...state,timeRange:'week'},{});assert.equal(data.knowledgeCards.length,1);assert.match(data.knowledgeMessage,/unabhängig vom gewählten Zeitraum/);assert(data.cache.cacheable);
  h.plane.buckets.set('family:duckduckgo',{blockedUntil:Date.now()+10000});assert.equal(h.plane.eligible(ddg,{...state,category:'knowledge'}),'provider_family_cooldown');
 }finally{await h.close();}
});
test('cache epoche changes on policies, not observations; telemetry separates cards without query data',async()=>{
 const h=await harness();try{const x=new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture'),a=x.cacheEpoch();await h.grant('source');assert.notEqual(x.cacheEpoch(),a);const b=x.cacheEpoch();await h.plane.observe(h.adapter.catalog.get('source'),state,{outcome:'empty',results:[],durationMs:1});assert.equal(x.cacheEpoch(),b);const e=event('engine.observed',{q:'private',url:'https://private.test',validKnowledgeCount:1,validResultCount:0});assert.equal(e.data.validKnowledgeCount,1);assert.equal(e.data.q,undefined);assert.equal(e.data.url,undefined);
 }finally{await h.close();}
});

test('a native recovery lease excludes a sibling even across separate administrative families',async()=>{
 const h=await harness([engine('a'),engine('b')]);try{for(const e of h.adapter.catalog.values()){await h.grant(e.id);h.adapter.nativeScopes.set(e.id,'b'.repeat(32));h.plane.healthFor(e.id,'general').breaker='open';}
 const [a,b]=await Promise.all([h.plane.reserve(h.adapter.catalog.get('a'),state),h.plane.reserve(h.adapter.catalog.get('b'),state)]);assert(a.recovering);assert.equal(b.reason,'watch_required');await h.plane.observe(h.adapter.catalog.get('a'),state,{outcome:'empty',results:[],durationMs:1});a.release();await h.plane.serial;const c=await h.plane.reserve(h.adapter.catalog.get('b'),state);assert(c.recovering);await h.plane.observe(h.adapter.catalog.get('b'),state,{outcome:'empty',results:[],durationMs:1});c.release();}finally{await h.close();}
});

test('disabled demand recovery stays closed to dispatch and the Observatory explains the disabled feature',async()=>{
 const h=await harness();try{await h.grant('source');const e=h.adapter.catalog.get('source');h.plane.healthFor(e.id,'general').breaker='open';h.plane.demandRecovery=false;assert.equal((await h.plane.reserve(e,state)).reason,'watch_required');assert.equal(h.plane.availability(e,'general').reason,'watch_required');}finally{await h.close();}
});
test('a policy revision during an otherwise complete stream prevents capture',async()=>{
 const h=await harness();try{await h.grant('source');h.adapter.execute=async()=>{await h.grant('source');return {outcome:'success',results:[{url:'https://example.org/fixture',title:'fixture'}],infoboxes:[],durationMs:1};};const data=await new SearchExecutor(h.plane,new MediaProxy('fixture'),'fixture').load(state,{});assert.equal(data.error,false);assert.equal(data.cache.cacheable,false);}finally{await h.close();}
});

test('fallback candidate inspection never distorts the next primary family rotation',async()=>{
 const h=await harness([engine('ddg definitions',['knowledge']),engine('wikipedia',['knowledge']),engine('wikidata',['knowledge'])]);try{for(const e of h.adapter.catalog.values())await h.grant(e.id,{family:e.id==='ddg definitions'?'duckduckgo':'wikimedia'});const k={...state,category:'knowledge'},families=[];for(let i=0;i<6;i++){const primary=h.plane.knowledgePlan(k)[0];families.push(h.plane.policy(primary.id).family);h.plane.knowledgePlan(k,5,[primary.id]);}assert.deepEqual(families,['duckduckgo','wikimedia','duckduckgo','wikimedia','duckduckgo','wikimedia']);}finally{await h.close();}
});

test('a concurrent review cannot make lease cleanup overwrite a newer observed quarantine',async()=>{
 const h=await harness();try{await h.grant('source');const e=h.adapter.catalog.get('source');h.plane.healthFor(e.id,'general').breaker='open';const trial=await h.plane.reserve(e,state);await h.grant('source',{reason:'recovery_review',quarantine:false});await h.plane.observe(e,state,{outcome:'error',errorClass:'unsafe_url_scheme',results:[],durationMs:1});trial.release();await h.plane.serial;assert.equal(h.plane.healthFor(e.id,'general').quarantine,'unsafe_url_scheme');const persisted=await h.store.call('load');assert.equal(JSON.parse(persisted.guards.find(g=>g.id==='health:source:general').value).quarantine,'unsafe_url_scheme');}finally{await h.close();}
});
