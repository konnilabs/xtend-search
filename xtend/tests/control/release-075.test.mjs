import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonResponse} from '../../server/control/adapter.mjs';
import {SearchExecutor,settleEngine} from '../../server/control/executor.mjs';
import {presentSearchFrames,interruptedSearch} from '../../frontend/stream-service-core.mjs';
import {applyReportAction} from '../../frontend/report-service-core.mjs';
import {emptyReport} from '../../frontend/report-state.mjs';
import {applyPreviewUpdate} from '../../frontend/preview-service-core.mjs';

test('a queued report intent uses the current Action Model and never replaces streamed results',()=>{
 const data={results:[1,2,3].map(id=>({id:String(id),reportKey:'r:'+id,reportTicket:'proof',url:'https://example.test/'+id,title:'Result'})),knowledgeCards:[]};
 const feedback={...emptyReport(),open:true},before=structuredClone(data);
 const context={stateRuntime:{getState:key=>key==='search.data'?data:feedback}};
 const result=applyReportAction({value:{selection:{id:'r:1',checked:true}}},context);
 assert.deepEqual(Object.keys(result),['feedback']);assert.deepEqual(data,before);
 assert.deepEqual(result.feedback.selectedKeys,['r:1']);assert.equal(result.feedback.selected.length,1);
 context.stateRuntime.getState=key=>key==='search.data'?data:result.feedback;
 assert.deepEqual(applyReportAction({value:{patch:{reason:'spam'}}},context).feedback.selectedKeys,['r:1']);
});

test('old image and expansion completions cannot clear a newer preview spinner',()=>{
 const current={open:true,id:'new',imageKey:'image-2',imageLoading:true,expansionLoading:true,expansionToken:'expand-2'};
 assert.deepEqual(applyPreviewUpdate({value:{type:'loaded',key:'image-1'}},current).value,current);
 assert.deepEqual(applyPreviewUpdate({value:{type:'expansion',id:'new',token:'expand-1',busy:false}},current).value,current);
 const loaded=applyPreviewUpdate({value:{type:'loaded',key:'image-2'}},current).value;
 assert.equal(loaded.imageLoading,false);assert.equal(loaded.expansionLoading,true);
 const settled=applyPreviewUpdate({value:{type:'expansion',id:'new',token:'expand-2',busy:false}},loaded).value;
 assert.equal(settled.expansionLoading,false);
 assert.deepEqual(applyPreviewUpdate({value:{type:'failure',expectedKey:'image-1',unavailable:true}},current).value,current);
 const fallback=applyPreviewUpdate({value:{type:'failure',expectedKey:'image-2',src:'/media?fallback',key:'image-3',unavailable:false,message:'Fallback'}},current).value;
 assert.equal(fallback.imageLoading,true);assert.equal(fallback.imageKey,'image-3');
 assert.equal(applyPreviewUpdate({value:{type:'loaded',key:'image-3'}},fallback).value.imageLoading,false);
});

test('aborting a defective provider terminates its wait and safely consumes a late rejection',async()=>{
 const controller=new AbortController();let reject;
 const result=settleEngine(()=>new Promise((_,fail)=>{reject=fail;}),controller.signal);
 await new Promise(resolve=>setImmediate(resolve));controller.abort();
 assert.equal((await result).outcome,'cancelled');reject(Error('Late provider failure'));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await settleEngine(()=>{throw Error('Provider failure');},new AbortController().signal)).errorClass,'backend_unavailable');
});

test('a planning exception releases the global search admission slot',async()=>{
 const plane={revision:0,adapter:{catalog:new Map()},plan(){throw Error('Plan failure');}};
 const executor=new SearchExecutor(plane,null,'test-key');
 const state={q:'fixture',category:'general',language:'all',safeSearch:'1',timeRange:'',page:1};
 for(let i=0;i<20;i++){await assert.rejects(executor.load(state,{}),/Plan failure/);assert.equal(executor.active,0);}
});

test('invalid MIME, malformed/invalid UTF-8 JSON, oversized and missing bodies are bounded',async()=>{
 let cancelled=0;
 const body=new ReadableStream({cancel(){cancelled++;}});
 await assert.rejects(jsonResponse(new Response(body,{headers:{'Content-Type':'text/html'}})),/schema_invalid/);assert.equal(cancelled,1);
 for(const body of ['{',new Uint8Array([0x7b,0x22,0xff,0x22,0x3a,0x31,0x7d])])
  await assert.rejects(jsonResponse(new Response(body,{headers:{'Content-Type':'application/json'}})),/schema_invalid/);
 await assert.rejects(jsonResponse(new Response('"large"',{headers:{'Content-Type':'application/json'}}),3),/schema_invalid/);
 await assert.rejects(jsonResponse(new Response(null,{headers:{'Content-Type':'application/json'}})),/schema_invalid/);
 assert.deepEqual(await jsonResponse(new Response('{"value":"雪"}',{headers:{'Content-Type':'application/json'}})),{value:'雪'});
});

test('incomplete or contradictory terminal frames preserve the partial result and disable caching',async()=>{
 for(const tail of [{type:'error'},null,{type:'complete',value:{event:'results.batch',data:{results:[]}}},{type:'delta',value:{event:'search.summary',data:{results:[]}}}]){
  const shown=[];
  async function* frames(){yield {type:'delta',value:{event:'results.batch',data:{results:[{id:'first'}],warnings:[],cache:{cacheable:true}}}};if(tail)yield tail;}
  await assert.rejects(presentSearchFrames(frames(),{signal:new AbortController().signal,present:async payload=>shown.push(payload.data)},{id:'fixture'}));
  assert.equal(shown.length,1);const interrupted=interruptedSearch(shown[0],{id:'fixture'});
  assert.equal(interrupted.results[0].id,'first');assert.equal(interrupted.cache.cacheable,false);assert.equal(interrupted.stream.phase,'error');
 }
});
