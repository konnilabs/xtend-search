import test from 'node:test';
import assert from 'node:assert/strict';
import {captureSearchResource as capture,restoreSearchResource as restore,invalidateSearchResource as invalidate,clearSearchResources as clear,searchCacheStats as stats} from '../../frontend/cache-service-core.mjs';
import {identityFromUrl,searchResourceKey} from '../../shared/cache-identity.mjs';
const scope={version:'fixture-build',contextKey:'public-fixture'},epoch='a'.repeat(64);
const url=(q='fixture',category='general')=>'http://localhost/search?'+new URLSearchParams({q,categories:category,language:'all',time_range:'',safesearch:'1'});
function data(q='fixture',patch={}){const now=Date.now();return {results:[{id:'fixture',title:'Fixture'}],stream:{phase:'complete'},cache:{enabled:true,cacheable:true,url:url(q),identity:identityFromUrl(url(q)),epoch,createdAt:now,expiresAt:now+600000,tokenExpiresAt:now+900000,mediaExpiresAt:now+1800000,feedbackExpiresAt:now+1800000},...patch};}
const context={cacheContextQuery:async()=>({schema:'xtend.search.cache-context.v1',enabled:true,epoch})};
test('completed resources copy data, preserve exact identity and do not retain form drafts or a router',async()=>{
 clear();const original=data('GNU/ Linux');assert(capture({data:original,scope}));original.results[0].title='mutation';const a=await restore({url:url('GNU/ Linux'),scope},context);assert.equal(a.data.results[0].title,'Fixture');a.data.results[0].title='second';assert.equal((await restore({url:url('GNU/ Linux'),scope},context)).data.results[0].title,'Fixture');assert.equal(await restore({url:url('GNU/Linux'),scope},context),null);assert.equal(await restore({url:url('GNU/ Linux','images'),scope},context),null);assert.equal(await restore({url:url('GNU/ Linux'),scope:{...scope,contextKey:'admin'}},context),null);assert(invalidate({url:url('GNU/ Linux'),scope}));assert.equal(stats().entries,0);
});
test('policy epochs, failed metadata, aborted resolutions and token expiry prevent restoration',async()=>{
 clear();assert(capture({data:data(),scope}));assert.equal(await restore({url:url(),scope},{cacheContextQuery:async()=>({...await context.cacheContextQuery(),epoch:'b'.repeat(64)})}),null);assert.equal(stats().entries,0);
 assert(capture({data:data(),scope}));await assert.rejects(restore({url:url(),scope},{cacheContextQuery:async()=>{throw Error('offline');}}),/offline/);const controller=new AbortController();await assert.rejects(restore({url:url(),scope},{signal:controller.signal,cacheContextQuery:async()=>{controller.abort();return context.cacheContextQuery();}}));
 const expired=data();expired.cache.tokenExpiresAt=Date.now()+29000;assert.equal(capture({data:expired,scope}),false);clear();
});
test('errors, incomplete streams, policy changes and oversized resources are never stored',()=>{
 clear();for(const patch of [{error:true},{skeleton:true},{stream:{phase:'partial'}},{stream:{phase:'error'}}])assert.equal(capture({data:data('fixture',patch),scope}),false);
 const changed=data();changed.cache.cacheable=false;assert.equal(capture({data:changed,scope}),false);assert.equal(capture({data:data('huge',{results:[{text:'x'.repeat(8*1024*1024)}]}),scope}),false);assert.equal(stats().entries,0);
});
test('ten-entry LRU and non-sliding empty TTL survive repeated reads and context disposal',async()=>{
 clear();for(let i=0;i<11;i++)assert(capture({data:data('fixture '+i),scope}));assert.equal(stats().entries,10);assert.equal(await restore({url:url('fixture 0'),scope},context),null);
 clear();const realNow=Date.now,start=realNow();try{Date.now=()=>start;assert(capture({data:data('empty',{empty:true}),scope}));Date.now=()=>start+59000;assert(await restore({url:url('empty'),scope},context));Date.now=()=>start+61000;assert.equal(await restore({url:url('empty'),scope},context),null);}finally{Date.now=realNow;clear();}assert.equal(stats().bytes,0);
});
test('ambiguous, unknown and cookie-dependent URLs cannot alias a cache key',()=>{
 assert.equal(identityFromUrl('/search?q=fixture'),null);assert.equal(identityFromUrl(url()+'&q=other'),null);assert.equal(identityFromUrl(url()+'&engine=foreign'),null);assert.equal(identityFromUrl('/admin'),null);const a=identityFromUrl(url('GNU/ Linux'));assert.notEqual(searchResourceKey(a,scope,epoch),searchResourceKey({...a,q:'GNU/Linux'},scope,epoch));
});
