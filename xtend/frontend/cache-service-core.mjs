import {createPageResourceCache} from '@ccslabs/xtend/rmt/page-resource-cache';
import {identityFromUrl,searchResourceKey} from '../shared/cache-identity.mjs';
const resources=createPageResourceCache({ttlMs:600000,maxEntries:10,maxBytes:8*1024*1024,now:()=>Date.now()});
let epoch=null,scopeKey=null;
const scopeId=s=>JSON.stringify([s.version,s.contextKey]);
export function clearSearchResources(){resources.clear();epoch=null;scopeKey=null;}
export function searchCacheStats(){return resources.stats();}
export function captureSearchResource({data,scope}){
 const meta=data?.cache;
 if(!meta?.enabled||meta.cacheable!==true||data.error||data.skeleton||data.stream?.phase&&data.stream.phase!=='complete'||!scope?.version||!scope.contextKey)return false;
 const identity=identityFromUrl(meta.url);if(!identity?.q.trim()||JSON.stringify(identity)!==JSON.stringify(meta.identity))return false;
 if(!/^[a-f0-9]{64}$/.test(meta.epoch)||!Number.isFinite(meta.expiresAt)||!Number.isFinite(meta.tokenExpiresAt))return false;
 const expiresAt=Math.min(meta.expiresAt,meta.tokenExpiresAt-30000,meta.mediaExpiresAt-30000,meta.feedbackExpiresAt-30000);if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())return false;
 const nextScope=scopeId(scope);if(scopeKey!==nextScope||epoch!==meta.epoch)clearSearchResources();scopeKey=nextScope;epoch=meta.epoch;
 // Only immutable result inputs; no UI drafts, selected preview, SSR or head snapshot.
 return resources.set(searchResourceKey(identity,scope,epoch),{data:{...data,stream:{phase:'complete'}},identity,epoch},{ttlMs:data.empty?60000:600000,expiresAt});
}
export function invalidateSearchResource({url,scope}={}){
 if(!url||!scope){clearSearchResources();return true;}const identity=identityFromUrl(url);return identity&&epoch?resources.delete(searchResourceKey(identity,scope,epoch)):false;
}
export async function restoreSearchResource({url,scope},context){
 const identity=identityFromUrl(url);if(!identity?.q.trim()||!epoch||scopeId(scope)!==scopeKey)return null;
 context.signal?.throwIfAborted();const snapshot=resources.get(searchResourceKey(identity,scope,epoch));if(!snapshot)return null;
 const current=await context.cacheContextQuery(context.signal);context.signal?.throwIfAborted();
 if(!current?.enabled||current.schema!=='xtend.search.cache-context.v1'||current.epoch!==epoch){clearSearchResources();return null;}
 return {...snapshot,requestUrl:url};
}
