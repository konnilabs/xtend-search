import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSearch,searchUrl,safeUrl,normalizeResults} from '../server/search.mjs';
const state=parseSearch(new URL('https://local/search?q=hello'));
test('URL state round trips Unicode and reserved characters',()=>{
 const expected={...state,q:'Grüße & x=<script> + ?',category:'images',language:'de',timeRange:'week',safeSearch:'2',page:3};
 assert.deepEqual(parseSearch(new URL(searchUrl(expected),'https://local')),expected);
});
test('home category preselection round trips without a query or a search page',()=>{
 const home={...state,q:'',category:'images',language:'de',timeRange:'week',safeSearch:'2'};
 const url=new URL(searchUrl(home),'https://local');
 assert.equal(url.pathname,'/');
 assert.deepEqual(parseSearch(url),home);
 assert.equal(searchUrl({...state,q:''}),'/');
 assert.equal(searchUrl({...state,q:''},{category:'images'}),'/?categories=images');
 assert.equal(searchUrl({...home,q:'  '},{category:'general'}),'/?language=de&time_range=week&safesearch=2');
});
test('reject invalid filters, oversized input and invalid pagination',()=>{
 for(const params of ['pageno=0','pageno=1.5','pageno=101','pageno=NaN','categories=admin','language=xx','safesearch=3','time_range=century','q='+ 'a'.repeat(2049)])assert.throws(()=>parseSearch(new URL('https://local/search?'+params)),{status:400});
});
test('unsafe links cannot reach rendering',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,evil','//evil.test','file:///etc/passwd','https://user:password@evil.test'])assert.equal(safeUrl(url),null);
 assert.equal(safeUrl('https://example.org/a'),'https://example.org/a');
});
test('normalization retains text, deduplicates, tolerates broken escaping and drops foreign images',()=>{
 const raw={xtend:{schema:'searxng-xtend.core.v1',paging:true},results:[{url:'https://example.org/%zz',title:'<script>alert(1)</script>',content:'<img onerror=alert(1)>',xtend_thumbnail:'https://tracker.test/a.png'},{url:'https://example.org/%zz'},{url:'javascript:alert(1)'}]};
 const data=normalizeResults(raw,state);assert.equal(data.results.length,1);assert.equal(data.results[0].title,raw.results[0].title);assert.equal(data.results[0].thumbnail,'');assert.equal(data.pages.length,1);
 const again=normalizeResults(raw,state);assert.equal(data.results[0].id,again.results[0].id);
});
test('empty, failed and partial engine responses remain distinguishable',()=>{
 const base={xtend:{schema:'searxng-xtend.core.v1',paging:true},results:[]};
 assert.equal(normalizeResults(base,state).empty,true);
 const failed=normalizeResults({...base,unresponsive_engines:[['fixture','timeout']]},state);assert.equal(failed.error,true);assert.equal(failed.empty,false);assert.equal(failed.pages.length,0);
 const partial=normalizeResults({...base,results:[{url:'https://example.org'}],unresponsive_engines:[['fixture','timeout']]},state);assert.equal(partial.error,false);assert.equal(partial.warnings.length,1);
});
test('backend effective supported filters are authoritative',()=>{
 const data=normalizeResults({results:[],xtend:{schema:'searxng-xtend.core.v1',state:{categories:['images'],language:'de',time_range:'day',safesearch:2}}},state);
 assert.equal(data.category,'images');assert.equal(data.language,'de');assert.equal(data.safeSearch,'2');
});
test('knowledge cards keep safe sources, facts and related searches without trusting HTML',()=>{
 const raw={results:[],xtend:{schema:'searxng-xtend.core.v1'},infoboxes:[{id:'one',infobox:'Knowledge <script>',content:'<img onerror=evil()>',xtend_content_text:'Plain description',xtend_image:'https://tracking.invalid/pixel',urls:[{title:'Source',url:'https://example.org'},{title:'Bad',url:'javascript:evil()'}],attributes:[{label:'Fact',xtend_value_text:'A & B',xtend_image:'/image_proxy?url=x&h=y'}],relatedTopics:[{suggestions:['special & query']}]},{id:'one',infobox:'Duplicate'}]};
 const d=normalizeResults(raw,state);assert.equal(d.knowledgeCards.length,1);assert.equal(d.hasKnowledge,true);assert.equal(d.empty,false);assert.equal(d.error,false);
 const c=d.knowledgeCards[0];assert.equal(c.description,'Plain description');assert.equal(c.image,'');assert.equal(c.links.length,1);assert.equal(c.facts[0].value,'A & B');assert.equal(new URL(c.related[0].url,'https://local').searchParams.get('q'),'special & query');
});
test('images on the same source page retain separate identities and only proxied previews',()=>{
 const raw={xtend:{schema:'searxng-xtend.core.v1'},results:[{url:'https://example.org/gallery',img_src:'https://images.test/one.png',xtend_image:'/image_proxy?url=one&h=x',xtend_thumbnail:'/image_proxy?url=small&h=x',resolution:'1600 × 1000',filesize:'240 KB',formats:[{url:'javascript:evil()'},{url:'https://images.test/one.webp',label:'WebP'}]},{url:'https://example.org/gallery',img_src:'https://images.test/two.png',xtend_image:'https://tracker.test/large.png'},{url:'https://example.org/gallery',img_src:'https://images.test/one.png'}]};
 const d=normalizeResults(raw,{...state,category:'images'});assert.equal(d.results.length,2);assert.notEqual(d.results[0].id,d.results[1].id);assert.ok(d.results[0].previewId);assert.equal(d.results[1].previewId,'');assert.equal(d.results[1].previewSrc,'');assert.equal(d.results[0].formats.length,1);assert.equal(d.results[0].metadata[0].value,'1600 × 1000');assert.equal(d.results[0].previewHref,'https://images.test/one.png');
});
test('image retry identities preserve signed source URLs and stay stable within a stream',()=>{
 const source='https://images.test/picture.png?size=small&color=blue',proxy='/image_proxy?'+new URLSearchParams({url:source,h:'signed-source'});
 const raw={xtend:{schema:'searxng-xtend.core.v1'},results:[{url:'https://example.org/image',xtend_thumbnail:proxy,xtend_image:proxy}]};
 const one=normalizeResults(raw,state,{imageGeneration:'first'}).results[0],batch=normalizeResults(raw,state,{imageGeneration:'first'}).results[0],retry=normalizeResults(raw,state,{imageGeneration:'second'}).results[0];
 assert.equal(one.thumbnail,batch.thumbnail);assert.equal(one.thumbnailKey,batch.thumbnailKey);assert.notEqual(one.thumbnail,retry.thumbnail);assert.equal(one.id,retry.id);
 for(const item of [one,retry])for(const value of [item.thumbnail,item.previewSrc]){const url=new URL(value,'https://local');assert.equal(url.origin,'https://local');assert.equal(url.pathname,'/image_proxy');assert.equal(url.searchParams.get('url'),source);assert.equal(url.searchParams.get('h'),'signed-source');}
});
