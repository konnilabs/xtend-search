import test from 'node:test';import assert from 'node:assert/strict';
import {SearxAdapter,PINNED} from '../../server/control/adapter.mjs';
const headers={'Content-Type':'application/json','X-XTend-Backend-Contract':'engine-json-v1','X-XTend-Engine-Health-Contract':'engine-health-v1','X-XTend-Backend-Instance':'fixture-instance'};
const e=name=>({name,categories:['general'],enabled:true,paging:false,language_support:true,languages:['en','de'],safesearch:false,time_range_support:false,timeout:1});
const catalog={version:PINNED,plugins:[],engines:['wikipedia','wikidata','ddg definitions'].map(e)},row={id:'wikidata',scope:'a'.repeat(32),remainingMs:60000,errorClass:'captcha'};
const json=value=>new Response(JSON.stringify(value),{headers});
test('private native health is authenticated, metadata-only and rejects forged scope, duration and attribution',async()=>{
 let calls=0,value={schema:'xtend.engine-health.v1',instanceId:'fixture-instance',engines:[row]};const adapter=new SearxAdapter({baseUrl:'http://backend/',token:'fixture-only',fetchImpl:async(url,init)=>{assert.equal(init.headers.Authorization,'Bearer fixture-only');if(url.pathname==='/config')return json(catalog);assert.equal(url.pathname,'/xtend/engine-health');calls++;return json(value);}});await adapter.discover();assert.equal((await adapter.health(['wikidata'])).engines[0].remainingMs,60000);assert.equal(adapter.nativeScopes.get('wikidata'),row.scope);for(const bad of [{...row,scope:'unsafe'},{...row,remainingMs:-1},{...row,remainingMs:Infinity},{...row,id:'wikipedia'},{...row,errorClass:'invented'}]){value={...value,engines:[bad]};await assert.rejects(()=>adapter.health(['wikidata']));}
 value={...value,engines:[]};await adapter.health([]);assert.equal(calls,7);await assert.rejects(()=>adapter.health(['unknown']));await assert.rejects(()=>adapter.health(['wikidata','wikidata']));
});
test('reviewed knowledge capability is additive; DDG keeps explicit English and SafeSearch limitations',async()=>{
 const adapter=new SearxAdapter({baseUrl:'http://backend/',token:'fixture-only',fetchImpl:async()=>json(catalog)});await adapter.discover();assert(adapter.catalog.get('wikipedia').capabilities.includes('knowledge'));const ddg=adapter.catalog.get('ddg definitions');assert(ddg.capabilities.includes('knowledge'));assert.equal(ddg.knowledgeLanguage,'english');assert.equal(ddg.safeSearch,false);assert.match(ddg.knowledgeLanguageNotice,/englisch/);
});
