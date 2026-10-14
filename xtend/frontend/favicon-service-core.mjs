// Bounded image I/O and RAM resource ownership. No View or DOM dependencies.
export function createFaviconResources({fetchImage=fetch,createUrl=blob=>URL.createObjectURL(blob),revokeUrl=url=>URL.revokeObjectURL(url)}={}){
 const cache=new Map(),pending=new Map();let disposed=false;
 async function load(src,signal){
  if(disposed||typeof src!=='string'||!src.startsWith('/favicon?'))return null;
  if(cache.has(src))return cache.get(src);if(pending.has(src))return pending.get(src);
  const work=(async()=>{const response=await fetchImage(src,{signal,priority:'low',credentials:'same-origin',referrerPolicy:'no-referrer'});if(!response.ok||response.status===204)return null;const blob=await response.blob();signal?.throwIfAborted();if(blob.type!=='image/png'||disposed)return null;const url=createUrl(blob);cache.set(src,url);if(cache.size>300){const [key,value]=cache.entries().next().value;revokeUrl(value);cache.delete(key);}return url;})();
  pending.set(src,work);try{return await work;}finally{if(pending.get(src)===work)pending.delete(src);}
 }
 return {load,get:src=>cache.get(src),decorate:results=>(results||[]).map(row=>({...row,faviconSrc:cache.get(row.favicon)||''})),dispose(){disposed=true;for(const url of cache.values())revokeUrl(url);cache.clear();pending.clear();}};
}
export const faviconResources=createFaviconResources();
