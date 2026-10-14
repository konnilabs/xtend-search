// Bounded image I/O and RAM resource ownership. No View or DOM dependencies.
export function createFaviconResources({fetchImage=fetch,createUrl=blob=>URL.createObjectURL(blob),revokeUrl=url=>URL.revokeObjectURL(url)}={}){
 const cache=new Map(),pending=new Map(),ready=new Set();let disposed=false;
 async function load(src,signal){
  if(disposed||typeof src!=='string'||!src.startsWith('/favicon?'))return null;
  signal?.throwIfAborted();if(cache.has(src))return cache.get(src);const previous=pending.get(src);if(previous&&!previous.signal?.aborted)return previous.promise;
  const work=(async()=>{const response=await fetchImage(src,{signal,priority:'low',credentials:'same-origin',referrerPolicy:'no-referrer'});if(!response.ok||response.status===204)return null;const blob=await response.blob();signal?.throwIfAborted();if(blob.type!=='image/png'||disposed)return null;const url=createUrl(blob);cache.set(src,url);if(cache.size>300){const [key,value]=cache.entries().next().value;revokeUrl(value);cache.delete(key);ready.delete(key);}return url;})();
  const record={promise:work,signal};pending.set(src,record);try{return await work;}finally{if(pending.get(src)===record)pending.delete(src);}
 }
 return {load,get:src=>cache.get(src),markReady(src,url){if(cache.get(src)!==url)return false;ready.add(src);return true;},decorate:results=>(results||[]).map(row=>({...row,faviconSrc:cache.get(row.favicon)||'',faviconReady:ready.has(row.favicon)})),dispose(){disposed=true;for(const url of cache.values())revokeUrl(url);cache.clear();pending.clear();ready.clear();}};
}
export const faviconResources=createFaviconResources();

// One in-flight projection and one boolean recheck, independent of scan count.
// Model content protects concurrent stream/image commits; equal favicon fields
// produce no command. This port never renders or holds a View reference.
export function createFaviconProjection({readResults,project,commit,isCurrent}){
 let requested=false,running=null,epoch=0,disposed=false;
 const differs=(before,after)=>before.length!==after.length||before.some((row,index)=>row.faviconSrc!==after[index].faviconSrc||row.faviconReady!==after[index].faviconReady);
 function request(own){
  if(disposed)return Promise.resolve();epoch=own;requested=true;if(running)return running;
  running=Promise.resolve().then(async()=>{
   while(requested&&!disposed){requested=false;const own=epoch;if(!isCurrent(own))continue;
    const before=readResults(),fingerprint=JSON.stringify(before),value=await project(before);if(disposed||!isCurrent(own))continue;
    if(JSON.stringify(readResults())!==fingerprint){requested=true;continue;}
    if(differs(before,value.results))await commit(value);
   }
  }).finally(()=>{running=null;});return running;
 }
 return {request,dispose(){disposed=true;requested=false;},snapshot:()=>({running:!!running,requested,disposed})};
}
