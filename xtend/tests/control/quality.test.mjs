import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../../server/control/store.mjs';
import {ControlPlane} from '../../server/control/plane.mjs';
import {QualityService} from '../../server/control/quality.mjs';
import {EvidenceStore} from '../../server/control/evidence.mjs';
import {event} from '../../server/control/telemetry.mjs';
const admin={actor:'admin',role:'administrator'},operator={actor:'op',role:'operator'},viewer={actor:'view',role:'viewer'};
async function harness(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xsearch-quality-')),store=new Store(path.join(dir,'control'));let now=Date.now();
 const adapter={status:'compatible',lastRefresh:Date.now(),catalog:new Map(['one','two','three'].map(id=>[id,{id,capabilities:['general','images'],language:true,languages:['en'],safeSearch:true,timeRange:true,timeout:1000,paging:true,fingerprint:'fp-'+id}])),async discover(){return this.catalog;}};
 const plane=new ControlPlane({store,adapter});await plane.initialize();const evidence=new EvidenceStore(path.join(dir,'evidence'),'test-key',{now:()=>now});await evidence.initialize();const quality=new QualityService(plane,evidence,{now:()=>now});quality.adopt((await store.call('load')).quality);
 for(const id of adapter.catalog.keys())await plane.mutate('policy',{id,state:'allowed',capabilities:['general','images'],family:id,rpm:30,concurrency:2,reason:'initial_review',revision:plane.revision,requestKey:randomUUID()},admin);
 return {dir,store,plane,quality,evidence,advance(ms){now+=ms;},get now(){return now;},ticket(engines=['one'],capability='general',id=randomUUID()){return quality.ticket('https://evidence.example.org/PRIVATE_RESULT?context=PRIVATE_URL',engines,capability,id);},async send(reason='spam',browser=randomUUID(),engines=['one'],extra={}){return quality.submit({ticket:this.ticket(engines),reason,includeUrl:false,...extra},{browser,network:'test-network'});},async rule(id='one',capability='general'){return quality.mutate('rule',{id,capability,revision:plane.revision,requestKey:randomUUID(),enabled:true,threshold:20,contexts:10,windowMinutes:60,cooldownMinutes:15},admin);},async close(){await plane.close();await fs.rm(dir,{recursive:true,force:true});}};
}
test('feedback claims resist forgery, attribute only actual contributors, deduplicate replay and keep URLs out of control state',async()=>{
 const h=await harness();try{const ticket=h.ticket(['one','two']);assert.ok(!ticket.includes('PRIVATE'));await assert.rejects(()=>h.quality.submit({ticket:ticket+'x',reason:'spam',includeUrl:false},{browser:'a',network:'n'}));const input={ticket,reason:'spam',includeUrl:false,engineId:'three'};await h.quality.submit(input,{browser:'a',network:'n'});assert.equal((await h.quality.submit(input,{browser:'b',network:'n'})).duplicate,true);
 const state=await h.store.call('load');assert.deepEqual(state.quality.counts.map(x=>x.engine).sort(),['one','two']);assert.ok(!JSON.stringify(state).includes('PRIVATE'));assert.equal((await fs.readdir(path.join(h.dir,'evidence'))).length,0);
 const e=event('feedback.received',{engineId:'one',capability:'general',reason:'spam',url:'PRIVATE',query:'PRIVATE'});assert.equal(e.data.measurementScope,'quality_feedback');assert.ok(!JSON.stringify(e).includes('PRIVATE'));assert.equal(h.plane.healthFor('one','general').consecutive,0);
 }finally{await h.close();}
});
test('optional evidence is separate, encrypted, operator-only and expires after seven days',async()=>{
 const h=await harness();try{await h.send('broken','a',['one'],{includeUrl:true});const links=await h.quality.evidenceLinks({id:'one',capability:'general'},operator);assert.equal(links.length,1);assert.match(links[0].url,/PRIVATE_RESULT/);await assert.rejects(()=>h.quality.evidenceLinks({id:'one',capability:'general'},viewer));
 for(const name of await fs.readdir(path.join(h.dir,'evidence')))assert.ok(!(await fs.readFile(path.join(h.dir,'evidence',name),'utf8')).includes('PRIVATE'));assert.ok(!JSON.stringify(await h.store.call('load')).includes('PRIVATE'));
 h.advance(7*86400000+1);await h.evidence.rotate();assert.equal((await h.quality.evidenceLinks({id:'one',capability:'general'},operator)).length,0);
 }finally{await h.close();}
});
test('reports create one review at five reports from three contexts; limit and atomic audit conflict protect actions',async()=>{
 const h=await harness();try{for(let i=0;i<5;i++)await h.send('spam','c'+i%3);assert.equal(h.quality.state.proposals.length,1);await h.send('irrelevant','four');assert.equal(h.quality.state.proposals.length,1);const p=h.quality.state.proposals[0],command={id:'one',capability:'general',proposal:p.id,decision:'confirm',requestKey:randomUUID(),revision:h.plane.revision};
 await assert.rejects(()=>h.quality.mutate('decision',command,viewer));await assert.rejects(()=>h.quality.mutate('decision',{...command,revision:0},operator));assert.equal(h.quality.state.proposals[0].status,'pending');await h.quality.mutate('decision',command,operator);assert.equal(h.quality.state.proposals[0].status,'confirmed');const revision=h.plane.revision;assert.equal((await h.quality.mutate('decision',command,operator)).duplicate,true);assert.equal(h.plane.revision,revision);await assert.rejects(()=>h.quality.mutate('decision',{...command,decision:'dismiss'},operator));
 for(let i=0;i<5;i++)await h.send('spam','limited');await assert.rejects(()=>h.send('spam','limited'),/Zu viele/);
 }finally{await h.close();}
});
test('conservative auto cooldown is opt-in, waits for a new full window, scopes capability and preserves hard guards',async()=>{
 const h=await harness();try{await h.rule();for(let i=0;i<20;i++)await h.send('spam','warm'+i%10);assert.equal(h.quality.blocked('one','general'),false);h.advance(3600001);await h.quality.tick();for(let i=0;i<20;i++)await h.send('wrong_type','live'+i%10);assert.equal(h.quality.blocked('one','general'),true);assert.equal(h.quality.blocked('one','images'),false);assert.equal(h.quality.blocked('two','general'),false);assert.equal(h.quality.pause('one','general').until,h.now+15*60000);
 const state={category:'general',language:'all',safeSearch:'0',timeRange:'',page:1};assert.equal(h.plane.eligible(h.plane.adapter.catalog.get('one'),state),'quality_cooldown');
 h.plane.buckets.set('family:one',{blockedUntil:Date.now()+86400000});h.advance(16*60000);assert.equal(h.quality.blocked('one','general'),false);assert.equal(h.plane.eligible(h.plane.adapter.catalog.get('one'),state),'provider_family_cooldown');h.plane.buckets.delete('family:one');
 for(let i=0;i<20;i++)await h.send('spam','again'+i%10);assert.equal(h.quality.blocked('one','general'),false);
 const durable=await h.store.call('load');assert.ok(durable.quality.pauses[0].lastAutoAt);assert.ok(durable.audit.some(x=>x.actor==='system:quality'));const restarted=new QualityService(h.plane,h.evidence,{now:()=>h.now});restarted.adopt(durable.quality);assert.equal(restarted.pause('one','general').lastAutoAt,h.quality.pause('one','general').lastAutoAt);assert.throws(()=>restarted.claims(h.ticket()));
 }finally{await h.close();}
});
test('automations cannot pause the last available capability or act on irrelevance; three confirmations propose permanent review',async()=>{
 const h=await harness();try{await h.rule();h.advance(3600001);for(let i=0;i<20;i++)await h.send('irrelevant','a'+i%10);assert.equal(h.quality.blocked('one','general'),false);
 for(const id of ['two','three'])h.plane.policies.set(id,{...h.plane.policy(id),state:'disabled'});
 for(let i=0;i<20;i++)await h.send('spam','b'+i%10);assert.equal(h.quality.blocked('one','general'),false);
 for(let round=0;round<3;round++){if(round){h.advance(60001);for(let i=0;i<5;i++)await h.send('spam','review'+round+'-'+i);}const p=h.quality.state.proposals.find(p=>p.kind==='review'&&p.status==='pending');assert.ok(p);await h.quality.mutate('decision',{id:'one',capability:'general',proposal:p.id,decision:'confirm',revision:h.plane.revision,requestKey:randomUUID()},operator);}
 assert.equal(h.quality.state.proposals.filter(p=>p.kind==='disable'&&p.status==='pending').length,1);assert.equal(h.plane.policy('one').state,'allowed');
 }finally{await h.close();}
});

test('a knowledge engine is never counted as the remaining web source',async()=>{
 const h=await harness();try{await h.rule();h.advance(3600001);h.plane.policies.set('two',{...h.plane.policy('two'),state:'disabled'});h.plane.adapter.catalog.set('three',{...h.plane.adapter.catalog.get('three'),knowledge:true});for(let i=0;i<20;i++)await h.send('spam','context-'+i%10);assert.equal(h.quality.blocked('one','general'),false);}finally{await h.close();}
});
