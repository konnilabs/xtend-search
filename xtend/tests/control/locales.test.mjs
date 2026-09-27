import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {catalogLanguages,localeCatalogRepair,matchesLanguage} from '../../server/control/locales.mjs';
import {SearxAdapter,PINNED} from '../../server/control/adapter.mjs';
import {ControlPlane} from '../../server/control/plane.mjs';
import {Store} from '../../server/control/store.mjs';
import {SearchExecutor} from '../../server/control/executor.mjs';
const state={q:'open source',category:'images',language:'de',timeRange:'',safeSearch:'1',page:1,continuation:''};
const raw=(name,patch={})=>({name,categories:['images'],paging:true,language_support:true,languages:['de','en'],regions:[],safesearch:true,time_range_support:true,enabled:true,timeout:3,...patch});
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','X-XTend-Backend-Contract':'engine-json-v1'}});
function adapter(engines,calls=[]){return new SearxAdapter({baseUrl:'http://backend/',token:'fixture',fetchImpl:async(url,init)=>{
 if(url.pathname==='/config')return json({version:PINNED,plugins:[],engines});
 const id=init.body.get('engines');calls.push({id,language:init.body.get('language'),safeSearch:init.body.get('safesearch')});
 await new Promise(r=>setTimeout(r,id==='region images'?20:70));
 return json({results:[{url:'https://example.org/'+encodeURIComponent(id),title:id,img_src:'https://example.org/'+encodeURIComponent(id)+'.jpg',engines:[id],template:'images.html'}],infoboxes:[],unresponsive_engines:[]});
}});}

test('region-only SearXNG traits advertise language coverage without inventing unsupported languages',async()=>{
 const traits=JSON.parse(await fs.readFile(new URL('../../../searx/data/engine_traits.json',import.meta.url),'utf8'));
 const bing=traits['bing images']||traits.bing;
 const languages=catalogLanguages(Object.keys(bing.languages),Object.keys(bing.regions));
 assert.ok(languages.some(l=>matchesLanguage(l,'de')));assert.ok(languages.some(l=>matchesLanguage(l,'en')));
 assert.deepEqual(catalogLanguages(['de','en'],['de-DE','en-US']),['de','en']);
 assert.deepEqual(catalogLanguages([],['de_DE','invalid!','https://bad.example',null,'de-DE']),['de-DE']);
 assert.deepEqual(catalogLanguages([],undefined),[]);assert.ok(!matchesLanguage('de-DE','da'));assert.ok(matchesLanguage('sr_Latn','sr-Latn'));
});

test('locale fingerprint tracks added coverage; legacy approvals never silently bypass review',async()=>{
 const a=adapter([raw('region images',{languages:[],regions:['de-DE','en-US']}),raw('language images',{regions:['de-DE','en-US']})]);await a.discover();
 const region=a.catalog.get('region images'),language=a.catalog.get('language images');assert.notEqual(region.fingerprint,region.legacyLocaleFingerprint);assert.equal(language.fingerprint,language.legacyLocaleFingerprint);
 const saved={meta:{revision:7},policies:[{id:region.id,value:JSON.stringify({state:'allowed',fingerprint:region.legacyLocaleFingerprint})},{id:language.id,value:JSON.stringify({state:'disabled',fingerprint:'old'})}]};
 assert.deepEqual(localeCatalogRepair(saved,a.catalog).changes.map(c=>c.id),[region.id]);
 assert.equal(JSON.stringify(region).includes('legacyLocaleFingerprint'),false);
 saved.policies[0].value=JSON.stringify({state:'allowed',fingerprint:'different-capability'});assert.throws(()=>localeCatalogRepair(saved,a.catalog),/manuelle Prüfung/);
});

test('German image search streams both reviewed sources and keeps provider protection, budgets and disabled sources intact',async()=>{
 const calls=[],a=adapter([raw('region images',{languages:[],regions:['de-DE','en-US']}),raw('language images'),raw('protected images'),raw('unapproved images')],calls);await a.discover();
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'xsearch-locales-')),store=new Store(directory),plane=new ControlPlane({store,adapter:a});
 const admin={actor:'fixture-admin',role:'administrator'};await plane.initialize();
 async function approve(id){return plane.mutate('policy',{id,revision:plane.revision,reason:'maintenance',requestKey:randomUUID(),state:'allowed',capabilities:['images'],rpm:6,concurrency:1,family:id.replaceAll(' ','-'),pagingVerified:false},admin);}
 try{
  const region=a.catalog.get('region images');a.catalog.set(region.id,{...region,languages:[],fingerprint:region.legacyLocaleFingerprint});
  await approve(region.id);await approve('language images');await approve('protected images');a.catalog.set(region.id,region);
  const blockedUntil=Date.now()+3600000;plane.buckets.set('family:protected-images',{blockedUntil});await store.call('guards',[['family:protected-images',{blockedUntil}]]);
  assert.equal(plane.eligible(region,state),'capability_changed');
  const before=await store.call('load'),repair=localeCatalogRepair(before,a.catalog);assert.deepEqual(repair.changes.map(c=>c.id),[region.id]);
  await approve(region.id);const after=await store.call('load');assert.deepEqual(after.guards,before.guards);assert.equal(after.audit.length,before.audit.length+1);assert.equal(localeCatalogRepair(after,a.catalog).changes.length,0);
  const frames=[];for await(const f of new SearchExecutor(plane,{sign:u=>u},'fixture').run(state,{}))frames.push(f);
  assert.deepEqual(calls.map(c=>c.id).sort(),['language images','region images']);assert.ok(calls.every(c=>c.language==='de'&&c.safeSearch==='1'));
  assert.equal(frames.filter(f=>f.event==='results.batch').length,2);assert.equal(frames.at(-1).data.results.length,2);assert.match(frames.at(-1).data.statusLabel,/2 von 2/);
  assert.equal(plane.buckets.get('family:protected-images').blockedUntil,blockedUntil);assert.equal(plane.policy('unapproved images').state,'disabled');
  assert.equal(plane.eligible(region,{...state,language:'zz'}),'language');assert.equal(plane.eligible(region,{...state,page:2}),'paging');
  a.catalog.set(region.id,{...region,language:false});assert.equal(plane.eligible(a.catalog.get(region.id),state),'language');
  const policy={...plane.policy(region.id)};await plane.mutate('policy',{...policy,id:region.id,rpm:1,revision:plane.revision,reason:'maintenance',requestKey:randomUUID()},admin);a.catalog.set(region.id,region);
  assert.equal((await plane.reserve(region,state)).reason,'budget');
 }finally{await plane.close();await fs.rm(directory,{recursive:true,force:true});}
});
