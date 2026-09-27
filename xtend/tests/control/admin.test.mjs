import test from 'node:test';
import assert from 'node:assert/strict';
import {AdminService,adminView,poolFilters} from '../../server/control/admin.mjs';
const plane={telemetry:{sequence:1},snapshot:()=>({engines:[],time:Date.now(),backend:{status:'compatible'},events:[],audit:[],history:[],skips:[],budgets:[],probeEnabled:false})};
test('Observatory streams are bounded per account and release slots on cancellation',async()=>{
 const service=new AdminService(plane),context={actor:'fixture-admin',role:'administrator',signal:new AbortController().signal};
 const a=service.events({},context),b=service.events({},context),c=service.events({},context);
 assert.equal((await a.next()).value.value.reset,true);await b.next();await assert.rejects(()=>c.next(),/Zu viele/);assert.equal(service.streamCount,2);
 await a.return();await b.return();assert.equal(service.streamCount,0);assert.equal(service.streams.size,0);
});

const account={actor:'fixture-admin',role:'administrator'};
const engine=(id,capabilities)=>({id,capabilities,policy:{state:'disabled',rpm:6,concurrency:1,family:'shared',capabilities:[]},states:[],budget:{count:0,reset:0}});
const catalog=[engine('A web',['general']),engine('B mixed',['general','images']),engine('C social & IT',['social media','it'])];
const filteredPlane={...plane,snapshot:()=>({...plane.snapshot(),revision:1,engines:catalog}),refreshHistory:async()=>{}};
test('category and case-insensitive name filters compose and keep only matching selection',()=>{
 const view=adminView(filteredPlane,account,'A web',{category:'images',filterQuery:'MIX'});
 assert.equal(view.selected,'B mixed');assert.equal(view.poolCount,'1 passende Quellen · Seite 1 von 1');assert.equal(view.form.capabilities,'');
 const url=new URL(view.engines[0].url,'http://localhost');assert.equal(url.searchParams.get('category'),'images');assert.equal(url.searchParams.get('filterQuery'),'MIX');
 assert.match(view.engine.capabilityLabel,/Bilder \(images\)/);assert.equal(view.categoryOptions.find(c=>c.id==='images').label,'Bilder (1)');
 const social=adminView(filteredPlane,account,'',{category:'social media'});assert.equal(social.selected,'C social & IT');assert.equal(new URL(social.engines[0].url,'http://localhost').searchParams.get('engine'),'C social & IT');
});
test('empty filters never display an unrelated policy; reset is unfiltered',()=>{
 const view=adminView(filteredPlane,account,'A web',{category:'images',filterQuery:'nothing'});
 assert.equal(view.emptyPool,true);assert.equal(view.hasEngine,false);assert.equal(view.selected,'');assert.equal(view.engines.length,0);assert.equal(view.resetUrl,'/admin?view=sources');
 assert.deepEqual(poolFilters({category:'unsupported',filterQuery:' x '}),{category:'',filterQuery:'x'});assert.equal(poolFilters({filterQuery:'x'.repeat(500)}).filterQuery.length,100);
 assert.deepEqual(poolFilters(null),{category:'',filterQuery:''});
});
test('refresh and mutation retain filters without passing UI parameters into the policy write',async()=>{
 let written;const service=new AdminService({...filteredPlane,mutate:async(action,input)=>{written=input;return {message:'saved'};}});
 const input={id:'B mixed',category:'images',filterQuery:'mixed',capabilities:'general, images'};
 const snapshot=await service.snapshot(input,account);assert.equal(snapshot.engines.length,1);
 const saved=await service.mutate('policy',input,account);assert.equal(saved.selected,'B mixed');assert.equal(saved.engines.length,1);assert.equal(saved.filters.category,'images');assert.equal(saved.message,'saved');
 assert.deepEqual(written.capabilities,['general','images']);assert.equal('category' in written,false);assert.equal('filterQuery' in written,false);
});
