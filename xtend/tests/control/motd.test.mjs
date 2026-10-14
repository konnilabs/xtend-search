import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../../server/control/store.mjs';
import {ControlPlane} from '../../server/control/plane.mjs';
import {MotdService,DEFAULT_MOTD,motdDay,validateMotd} from '../../server/control/motd.mjs';
const admin={role:'administrator',actor:'admin'};
async function harness(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'xsearch-motd-')),store=new Store(dir),adapter={status:'compatible',lastRefresh:Date.now(),catalog:new Map(),async discover(){}};const plane=new ControlPlane({store,adapter});await plane.initialize();const motd=new MotdService(plane);return {dir,plane,store,motd,command:(operation,extra={})=>({operation,revision:plane.revision,requestKey:randomUUID(),...extra}),async close(){await plane.close();await fs.rm(dir,{recursive:true,force:true});}};}
test('daily selection is shared, persisted across restarts and does not change provider policy',async()=>{const h=await harness();try{assert.equal((await h.motd.current()).message,DEFAULT_MOTD);const revision=h.plane.revision;const day=motdDay(Date.now());const values=await Promise.all(Array.from({length:20},()=>h.store.call('motdDay',{day})));assert.ok(values.every(v=>v.message===values[0].message));assert.equal(h.plane.revision,revision);await h.motd.mutate(h.command('list',{messages:'A\nB\nC'}),admin);const selected=await h.motd.current();assert.ok(['A','B','C'].includes(selected.message));assert.equal((await h.motd.current()).message,selected.message);const second=new MotdService(h.plane);assert.equal((await second.current()).message,selected.message);assert.equal(h.plane.policies.size,0);}finally{await h.close();}});
test('manual changes are immediate, audited, idempotent, role and revision protected',async()=>{const h=await harness();try{const input=h.command('override',{message:'Heute anders.'});for(const role of ['viewer','operator'])await assert.rejects(()=>h.motd.mutate(input,{role,actor:role}));await h.motd.mutate(input,admin);assert.equal((await h.motd.current()).message,'Heute anders.');const revision=h.plane.revision;await h.motd.mutate(input,admin);assert.equal(h.plane.revision,revision);await assert.rejects(()=>h.motd.mutate({...input,message:'Replay geändert'},admin));await assert.rejects(()=>h.motd.mutate({...h.command('rotate'),revision:0},admin));const saved=await h.store.call('load');assert.equal(saved.audit.filter(x=>x.action==='motd').length,1);assert.equal(saved.motd.manual,true);const tomorrow=await h.store.call('motdDay',{day:'2099-01-02'});assert.equal(tomorrow.manual,false);assert.equal(tomorrow.message,DEFAULT_MOTD);}finally{await h.close();}});
test('day boundary uses Berlin including daylight saving; input stays bounded plain text',()=>{assert.equal(motdDay(Date.parse('2026-10-11T21:59:59Z')),'2026-10-11');assert.equal(motdDay(Date.parse('2026-10-11T22:00:00Z')),'2026-10-12');assert.equal(motdDay(Date.parse('2026-12-11T23:00:00Z')),'2026-12-12');assert.deepEqual(validateMotd({operation:'list',messages:' A \n\nA\nB'}).messages,['A','B']);for(const message of ['', 'x'.repeat(161),'A\nB','x\0'])assert.throws(()=>validateMotd({operation:'override',message}));assert.throws(()=>validateMotd({operation:'list',messages:Array.from({length:51},(_,i)=>''+i).join('\n')}));assert.equal(validateMotd({operation:'override',message:'<img src=x onerror=alert(1)>'}).message,'<img src=x onerror=alert(1)>');});
test('source scan rejects browser HTML parsing sinks while diagnostic reads remain allowed',async()=>{for(const folder of ['frontend','admin'])for(const name of await fs.readdir(new URL('../../'+folder+'/',import.meta.url),{recursive:true})){if(!/\.(mjs|ts)$/.test(name))continue;const source=await fs.readFile(new URL('../../'+folder+'/'+name,import.meta.url),'utf8');assert.doesNotMatch(source,/\.(?:innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(/,name);}});

test('worker restart retains manual selection, pool, revision and audit',async()=>{const h=await harness();let restarted;try{await h.motd.mutate(h.command('list',{messages:'A\nB'}),admin);await h.motd.mutate(h.command('override',{message:'Bleibt heute.'}),admin);const revision=h.plane.revision;await h.plane.close();const store=new Store(h.dir),plane=new ControlPlane({store,adapter:h.plane.adapter});await plane.initialize();restarted=plane;const motd=new MotdService(plane);assert.equal((await motd.current()).message,'Bleibt heute.');assert.deepEqual(plane.motdState.messages,['A','B']);assert.equal(plane.revision,revision);assert.equal(plane.audit.filter(x=>x.action==='motd').length,2);}finally{await restarted?.close();await h.close();}});
test('backend tick rotates across Berlin midnight without a page request or same-message repeat',async()=>{
 const h=await harness();try{
  await h.motd.mutate(h.command('list',{messages:'A\nB'}),admin);
  let now=Date.parse('2030-10-11T21:59:59Z');const service=new MotdService(h.plane,{now:()=>now});
  const before=await service.current(),revision=h.plane.revision,audit=(await h.store.call('load')).audit;
  now+=1000;await h.plane.tick();
  assert.equal(h.plane.motdState.day,'2030-10-12');assert.notEqual(h.plane.motdState.message,before.message);
  assert.equal(h.plane.motdState.manual,false);assert.equal(h.plane.revision,revision);
  assert.deepEqual((await h.store.call('load')).audit,audit);
  const shared=await Promise.all(Array.from({length:20},()=>service.current()));assert(shared.every(v=>v.message===shared[0].message));
  now+=43200000;for(let i=0;i<20;i++){const previous=await service.current();now+=86400000;assert.notEqual((await service.current()).message,previous.message);}
 }finally{await h.close();}
});
