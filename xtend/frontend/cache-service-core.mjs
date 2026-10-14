import {createPageResourceCache} from '@ccslabs/xtend/rmt/page-resource-cache';
import {identityFromUrl,searchResourceKey} from '../shared/cache-identity.mjs';
const resources=createPageResourceCache({ttlMs:600000,maxEntries:10,maxBytes:8*1024*1024,now:()=>Date.now()});
let epoch=null,weatherEpoch=null,scopeKey=null;
const scopeId=s=>JSON.stringify([s.version,s.contextKey]);
export function clearSearchResources(){resources.clear();epoch=null;weatherEpoch=null;scopeKey=null;}
export function searchCacheStats(){return resources.stats();}
export function captureSearchResource({data,scope}){
 const meta=data?.cache;
 if(!meta?.enabled||meta.cacheable!==true||data.error||data.skeleton||data.stream?.phase&&data.stream.phase!=='complete'||!scope?.version||!scope.contextKey)return false;
 const identity=identityFromUrl(meta.url);if(!identity?.q.trim()||JSON.stringify(identity)!==JSON.stringify(meta.identity))return false;
 const weather=meta.kind==='weather';if(!/^[a-f0-9]{64}$/.test(meta.epoch)||!Number.isFinite(meta.expiresAt)||!weather&&!Number.isFinite(meta.tokenExpiresAt))return false;
 const expiresAt=weather?meta.expiresAt:Math.min(meta.expiresAt,meta.tokenExpiresAt-30000,meta.mediaExpiresAt-30000,meta.feedbackExpiresAt-30000);if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())return false;
 const nextScope=scopeId(scope);if(scopeKey!==nextScope)clearSearchResources();scopeKey=nextScope;if(weather)weatherEpoch=meta.epoch;else epoch=meta.epoch;
 // Only immutable result inputs; no UI drafts, selected preview, SSR or head snapshot.
 return resources.set(searchResourceKey(identity,scope,meta.epoch),{data:{...data,results:(data.results||[]).map(({reportSelected,...r})=>({...r,reportSelected:false})),knowledgeCards:(data.knowledgeCards||[]).map(({reportSelected,...r})=>({...r,reportSelected:false})),stream:{phase:'complete'}},identity,epoch:meta.epoch},{ttlMs:weather?300000:data.empty?60000:600000,expiresAt});
}
export function invalidateSearchResource({url,scope}={}){
 if(!url||!scope){clearSearchResources();return true;}const identity=identityFromUrl(url);const e=identity?.category==='weather'?weatherEpoch:epoch;return identity&&e?resources.delete(searchResourceKey(identity,scope,e)):false;
}
export async function restoreSearchResource({url,scope},context){
 const identity=identityFromUrl(url),weather=identity?.category==='weather',e=weather?weatherEpoch:epoch;if(!identity?.q.trim()||!e||scopeId(scope)!==scopeKey)return null;
 context.signal?.throwIfAborted();const snapshot=resources.get(searchResourceKey(identity,scope,e));if(!snapshot)return null;
 const current=await context.cacheContextQuery(context.signal,weather);context.signal?.throwIfAborted();
 if(!current?.enabled||current.schema!==(weather?'xtend.search.weather-cache-context.v1':'xtend.search.cache-context.v1')||current.epoch!==e||weather&&snapshot.data.weather?.place?.countryCode==='DE'&&snapshot.data.cache.alertsVersion!=='off'&&snapshot.data.cache.alertsVersion!==current.alertsVersion){clearSearchResources();return null;}
 return {...snapshot,requestUrl:url};
}
