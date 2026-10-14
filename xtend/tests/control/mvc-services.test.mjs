import test from 'node:test';
import assert from 'node:assert/strict';
import {carouselModel,carouselMove,carouselFailure,overlayState} from '../../frontend/overlay-service-core.mjs';
import {reduceReport,selectReport,submitReport} from '../../frontend/report-service-core.mjs';
import {emptyReport} from '../../frontend/report-state.mjs';
import {createFaviconResources} from '../../frontend/favicon-service-core.mjs';
import {updateDrafts,emptyAdminDrafts} from '../../admin/draft-service-core.mjs';
import {savePreferences} from '../../frontend/preferences-service-core.mjs';
const items=[0,1,2].map(id=>({id:String(id),previewId:String(id),previewSrc:`/media?id=${id}`,thumbnail:`/media?thumb=${id}`,title:`Bild ${id}`,url:'https://example.test/',imageUrl:'https://example.test/image'}));
test('carousel selection wraps, rejects untrusted media and retains fallback state',()=>{
 assert.equal(carouselMove({items,id:'2',delta:1}),'0');assert.equal(carouselMove({items,id:'0',delta:-1}),'2');
 assert.equal(carouselModel({items:[{...items[0],previewSrc:'https://untrusted.test/image'}],id:'0',key:'1'}),null);
 const media=carouselModel({items,id:'1',key:'7'});assert.equal(media.position,'Bild 2 von 3');
 const fallback=carouselFailure(media);assert.equal(fallback.src,items[1].thumbnail);assert.equal(fallback.key,'7:fallback');
 const unavailable=carouselFailure(fallback);assert.match(unavailable.src,/image-placeholder/);assert.match(unavailable.message,/weiterblättern/);
 assert.equal(overlayState({about:true,lightbox:false},{about:false}).active,false);
});
test('feedback selection is bounded, busy selection is ignored and drafts survive failed proof lookup',async()=>{
 const data={results:Array.from({length:6},(_,id)=>({id:String(id),reportKey:String(id),reportTicket:'ticket-'+id,url:'https://example.test/',title:'Result'}))};
 let feedback={...emptyReport(),open:true,reason:'spam'};
 for(let id=0;id<5;id++)feedback=reduceReport({previous:feedback,patch:selectReport({feedback,data,id:String(id),checked:true}),data}).feedback;
 assert.equal(feedback.canSave,true);assert.equal(feedback.selected.length,5);assert.match(selectReport({feedback,data,id:'5',checked:true}).error,/höchstens fünf/);
 assert.deepEqual(selectReport({feedback:{...feedback,busy:true},data,id:'0',checked:false}),{});
 const draft=structuredClone(feedback);await assert.rejects(submitReport({feedback,data,requestKey:'request'},{signal:new AbortController().signal},async()=>({ok:false})),/abgelaufen/);assert.deepEqual(feedback,draft);
});
test('favicon I/O is deduplicated, abort-safe, MIME-limited and disposed URLs are revoked',async()=>{
 let requests=0;const revoked=[];let release;
 const resources=createFaviconResources({fetchImage:async()=>{requests++;await new Promise(resolve=>release=resolve);return {ok:true,blob:async()=>({type:'image/png'})};},createUrl:()=> 'blob:fixture',revokeUrl:url=>revoked.push(url)});
 const signal=new AbortController().signal,first=resources.load('/favicon?domain=example.test',signal),second=resources.load('/favicon?domain=example.test',signal);release();assert.equal(await first,'blob:fixture');assert.equal(await second,'blob:fixture');assert.equal(requests,1);
 assert.equal(resources.decorate([{favicon:'/favicon?domain=example.test'}])[0].faviconSrc,'blob:fixture');resources.dispose();assert.deepEqual(revoked,['blob:fixture']);assert.equal(await resources.load('/favicon?domain=example.test',signal),null);
 const c=new AbortController();c.abort();const cancelled=createFaviconResources({fetchImage:async()=>({ok:true,blob:async()=>({type:'image/png'})}),createUrl:()=>{throw Error('must not create URL');}});await assert.rejects(cancelled.load('/favicon?domain=x',c.signal),{name:'AbortError'});
});
test('saving one admin draft leaves other form models unchanged',()=>{
 const drafts={'policy-form':{rpm:'59',safeSearchBypass:true},'routing-form':{mode:'parallel'}};
 assert.deepEqual(updateDrafts({drafts,id:'policy-form',remove:true,values:{}}),{...emptyAdminDrafts(),'routing-form':{mode:'parallel'}});assert.equal(drafts['policy-form'].rpm,'59');
});
test('preference service verifies cookie persistence and rejects an unconfirmed save',async()=>{
 const values=[['preferenceAction','save'],['language','en'],['time_range','day'],['safesearch','2']];let call=0;
 const fetchConfirmed=async()=> ++call===1?{ok:true}:{ok:true,json:async()=>({preferences:{language:'en',time_range:'day',safesearch:'2'}})};
 assert.match((await savePreferences({values},{signal:new AbortController().signal},fetchConfirmed)).message,/gespeichert/);
 await assert.rejects(savePreferences({values},{signal:new AbortController().signal},async()=>({ok:true,json:async()=>({preferences:null})})),/cookie blocked/);
});

import {presentSearchFrames,interruptedSearch} from '../../frontend/stream-service-core.mjs';
test('stream presentation supplies pull backpressure and aborts before the next provider frame',async()=>{
 let reads=0,release;const gate=new Promise(resolve=>release=resolve),seen=[],controller=new AbortController();
 async function* frames(){reads++;yield {type:'delta',value:{data:{results:[{id:'first'}]},event:'search.batch'},sequence:1};reads++;yield {type:'complete',value:{data:{results:[{id:'first'},{id:'second'}]},event:'search.summary'},sequence:2};}
 const running=presentSearchFrames(frames(),{signal:controller.signal,present:async payload=>{seen.push(payload);if(seen.length===1)await gate;}},{id:'stream',url:'/search?q=x'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,1);assert.equal(seen.length,1);controller.abort();release();await assert.rejects(running,{name:'AbortError'});assert.equal(reads,1);
 const partial=interruptedSearch({skeleton:false,results:[{id:'first'}],countLabel:'1 Ergebnis'},{id:'stream'});assert.equal(partial.results.length,1);assert.equal(partial.stream.phase,'error');
 await assert.rejects(presentSearchFrames((async function*(){})(),{signal:new AbortController().signal,present:async()=>{}},{id:'stream'}),/Unvollständiger/);
});
import {createFaviconProjection} from '../../frontend/favicon-service-core.mjs';
test('a fresh favicon owner does not reuse an aborted pending request or lose its pending slot',async()=>{
 const calls=[],oldOwner=new AbortController(),newOwner=new AbortController();
 const resources=createFaviconResources({fetchImage:async(_src,{signal})=>new Promise(resolve=>calls.push({signal,resolve})),createUrl:()=> 'blob:fresh',revokeUrl:()=>{}});
 const src='/favicon?domain=reentry.test',old=resources.load(src,oldOwner.signal);oldOwner.abort();
 const fresh=resources.load(src,newOwner.signal);assert.equal(calls.length,2);
 calls[0].resolve({ok:true,blob:async()=>({type:'image/png'})});await assert.rejects(old,{name:'AbortError'});
 const reused=resources.load(src,newOwner.signal);assert.equal(calls.length,2,'Old finally must not delete the fresh owner slot');
 calls[1].resolve({ok:true,blob:async()=>({type:'image/png'})});assert.equal(await fresh,'blob:fresh');assert.equal(await reused,'blob:fresh');resources.dispose();
});
test('favicon cache scans coalesce and equal projections do not grow a commit chain',async()=>{
 let rows=[{id:'result',faviconSrc:'',faviconReady:false}],projects=0,commits=0,release;
 const gate=new Promise(resolve=>release=resolve);
 const projection=createFaviconProjection({readResults:()=>rows,project:async before=>{projects++;if(projects===1)await gate;return {results:before.map(row=>({...row,faviconSrc:'blob:cached',faviconReady:true}))};},commit:async value=>{commits++;rows=value.results;},isCurrent:()=>true});
 const requests=Array.from({length:200},()=>projection.request(1));await new Promise(resolve=>setImmediate(resolve));assert.equal(projects,1);assert.equal(commits,0);release();await Promise.all(requests);assert.equal(commits,1);
 for(let i=0;i<20;i++)await projection.request(1);assert.equal(commits,1);assert.deepEqual(projection.snapshot(),{running:false,requested:false,disposed:false});projection.dispose();
});
test('favicon projection cannot overwrite a result snapshot replaced during service work',async()=>{
 let rows=[{id:'old',faviconSrc:'',faviconReady:false}],release,commits=0;
 const gate=new Promise(resolve=>release=resolve);let first=true;
 const projection=createFaviconProjection({readResults:()=>rows,project:async before=>{if(first){first=false;await gate;}return {results:before.map(row=>({...row,faviconSrc:'blob:'+row.id,faviconReady:true}))};},commit:async value=>{commits++;rows=value.results;},isCurrent:()=>true});
 const work=projection.request(1);await new Promise(resolve=>setImmediate(resolve));rows=[{id:'new',faviconSrc:'',faviconReady:false}];release();await work;assert.equal(rows[0].id,'new');assert.equal(rows[0].faviconSrc,'blob:new');assert.equal(commits,1);projection.dispose();
});
test('weather repeat rows project typed draft values without dynamic model paths',()=>{
 const value=updateDrafts({drafts:emptyAdminDrafts(),id:'weather-policy-form',values:{rpm:'17',concurrency:'3'},budget:[{id:'rpm',value:'60'},{id:'concurrency',value:'4'}]});
 assert.deepEqual(value['weather-policy-form'].budget.map(row=>row.value),['17','3']);
 assert.throws(()=>updateDrafts({drafts:{},id:'__proto__',values:{}}),/Unknown admin form/);
});
test('favicon projections compare immutable Model clones by content, not object identity',async()=>{
 let rows=[{id:'result',faviconSrc:'',faviconReady:false}],commits=0,projects=0;
 const projection=createFaviconProjection({readResults:()=>structuredClone(rows),project:async before=>{assert.ok(++projects<5,'Projection must terminate with cloned Model reads');return {results:before.map(row=>({...row,faviconSrc:'blob:cached',faviconReady:true}))};},commit:async value=>{commits++;rows=value.results;},isCurrent:()=>true});
 await projection.request(1);await projection.request(1);assert.equal(commits,1);assert.equal(projects,2);projection.dispose();
});
import {saveAdminForm,resolveAdminGuard,feedbackModel} from '../../admin/draft-service-core.mjs';
test('admin save failure leaves draft projection untouched and releases busy state',async()=>{
 const busy=[],notices=[];let projected=false;
 const ok=await saveAdminForm({serviceId:'admin.engine.policy.set',payload:{rpm:'17'}},{signal:new AbortController().signal,invokeServer:async()=>{throw Error('offline');},project:async()=>projected=true,announce:async values=>notices.push(...values),setBusy:async value=>busy.push(value)});
 assert.equal(ok,false);assert.equal(projected,false);assert.deepEqual(busy,[true,false]);assert.equal(notices[0].type,'error');
});
test('admin guard saves in order and stops before discarding a failed draft',async()=>{
 const saved=[];let discarded=false;
 assert.equal(await resolveAdminGuard({choice:'save',ids:['policy-form','routing-form']},{save:async id=>{saved.push(id);return false;},discard:async()=>discarded=true}),false);
 assert.deepEqual(saved,['policy-form']);assert.equal(discarded,false);
 assert.equal(await resolveAdminGuard({choice:'cancel',ids:[]},{save:async()=>true,discard:async()=>discarded=true}),false);
 const feedback=feedbackModel({current:{items:[]},change:{id:'notice',message:'offline',type:'error'}});assert.equal(feedback.items[0].duration,'0');assert.equal(feedbackModel({current:feedback,change:{dismiss:true,id:'notice'}}).items.length,0);
});
import {observeAdmin,evidenceModel} from '../../admin/live-service-core.mjs';
test('Observatory service drops stale scopes and awaits its presentation port',async()=>{
 const controller=new AbortController();let reads=0,url='/admin?engine=one';const seen=[];
 await observeAdmin({}, {signal:controller.signal,current:()=>({url}),openFrames:async function*(){reads++;yield {type:'delta',value:{view:{updated:'now'}}};reads++;yield {type:'delta',value:{view:{updated:'stale'}}};},present:async(update)=>{seen.push(update);assert.equal(reads,1);url='/admin?engine=two';},pause:async()=>controller.abort()});
 assert.equal(seen.length,1);assert.equal(seen[0].value.updated,'now');assert.equal(evidenceModel([]).rows.length,0);
});
