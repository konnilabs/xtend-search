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
