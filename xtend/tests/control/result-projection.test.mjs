import test from 'node:test';
import assert from 'node:assert/strict';
import {resultProjection,resultProjectionOwner,restoreResultThumbnails,applyResultProjection,readActionSearchData} from '../../frontend/result-projection-core.mjs';
import {createFaviconProjection} from '../../frontend/favicon-service-core.mjs';
const data=(category,count,stream=null)=>({state:{q:'cache',category},cache:{identity:{q:'cache',category},epoch:'epoch'},stream,
 results:Array.from({length:count},(_,id)=>({id:category+id,faviconSrc:'',faviconReady:false}))});
test('queued image projection is rejected against the restored resource at Action Model execution',()=>{
 const images=data('images',4,{id:'images'}),web=data('general',10);
 const old=resultProjection(images,images.results.map(row=>({...row,faviconSrc:'blob:old'})));
 const current=structuredClone(web),result=applyResultProjection({value:old},readActionSearchData({stateRuntime:{getState:id=>{assert.equal(id,'search.data');return current;}}}));
 assert.equal(result.accepted,false);assert.deepEqual(result.results,web.results);assert.deepEqual(current,web);
});
test('same-resource stream growth and equal-sized other resources also reject old projections',()=>{
 const partial=data('general',4,{id:'stream'}),complete=data('general',10,{id:'stream'});
 assert.equal(applyResultProjection({value:resultProjection(partial,partial.results)},complete).accepted,false);
 const other={...partial,state:{q:'other',category:'general'}};
 assert.equal(applyResultProjection({value:resultProjection(partial,partial.results)},other).accepted,false);
 assert.equal(applyResultProjection({value:{results:partial.results}},partial).accepted,false);
});
test('a current projection applies without replacing unrelated fields or relying on object identity',()=>{
 const current=data('general',10),rows=current.results.map(row=>({...row,faviconSrc:'blob:current',faviconReady:true}));
 const result=applyResultProjection({value:resultProjection(structuredClone(current),rows)},current);
 assert.equal(result.accepted,true);assert.deepEqual(result.results,rows);assert.equal(current.results[0].faviconSrc,'');
 assert.throws(()=>readActionSearchData({}),/Action Model reader/);
});
test('equal-props fresh navigation resets thumbnail failures without losing favicon or feedback fields',()=>{
 const canonical=[{id:'image',thumbnail:'/image_proxy?original',thumbnailKey:'original',thumbnailAlt:'Original'}];
 const current=[{...canonical[0],thumbnail:'placeholder',thumbnailKey:'failed',thumbnailFailed:true,faviconSrc:'blob:current',faviconReady:true,reportSelected:true}];
 const rows=restoreResultThumbnails(current,canonical);
 assert.deepEqual(rows,[{...canonical[0],thumbnailFailed:false,faviconSrc:'blob:current',faviconReady:true,reportSelected:true}]);
 assert.equal(current[0].thumbnailFailed,true);
});
test('favicon projection rechecks after a rejected queued CAS and decorates the restored ten results',async()=>{
 let current=data('images',4,{id:'images'}),release,reached;
 const gate=new Promise(resolve=>release=resolve),queued=new Promise(resolve=>reached=resolve),accepted=[];
 const projection=createFaviconProjection({readOwner:()=>resultProjectionOwner(current),readResults:()=>structuredClone(current.results),
  project:async rows=>({results:rows.map(row=>({...row,faviconSrc:'blob:'+row.id,faviconReady:true}))}),isCurrent:()=>true,
  commit:async(value,owner)=>{if(!accepted.length){reached();await gate;}const result=applyResultProjection({value:{...value,owner}},current);accepted.push(result.accepted);current={...current,results:result.results};return {status:'success',data:result};}});
 const work=projection.request(1);await queued;current=data('general',10);release();await work;
 assert.deepEqual(accepted,[false,true]);assert.equal(current.results.length,10);assert.ok(current.results.every(row=>row.id.startsWith('general')&&row.faviconReady));projection.dispose();
});
test('an error command outcome terminates favicon projection without retrying an unchanged Model',async()=>{
 const current=data('general',10);let commits=0;
 const projection=createFaviconProjection({readOwner:()=>resultProjectionOwner(current),readResults:()=>structuredClone(current.results),
  project:async rows=>({results:rows.map(row=>({...row,faviconSrc:'blob:cached',faviconReady:true}))}),isCurrent:()=>true,
  commit:async()=>{assert.equal(++commits,1,'Service errors must not be retried');return {status:'error'};}});
 await projection.request(1);assert.equal(commits,1);assert.equal(projection.snapshot().running,false);assert.equal(projection.snapshot().requested,false);
 assert.ok(current.results.every(row=>row.faviconSrc===''));projection.dispose();
});
