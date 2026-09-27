import test from 'node:test';
import assert from 'node:assert/strict';
import {FaviconService} from '../../server/control/favicons.mjs';
const adapter={faviconContract:true,base:new URL('http://backend:8082/'),token:'internal-only'},key=Buffer.alloc(32,1);
const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
function response(){return {headers:{},writeHead(status,headers={}){this.status=status;this.headers=headers;},end(body){this.body=body;}};}
const request=(service,domain)=>{const res=response(),url=new URL(service.sign('https://'+domain+'/private?q=canary'),'http://localhost');return {res,url,run:()=>service.handle({},res,url)};};
test('favicon proofs carry only domains, reject edits and gracefully disable with older backends',async()=>{
 const s=new FaviconService(adapter,key,{fetchImpl:async()=>new Response(png,{headers:{'content-type':'image/png'}})});
 assert.equal(new FaviconService({...adapter,faviconContract:false},key).sign('https://example.org'),'');assert.equal(new FaviconService(adapter,key,{resolver:'off'}).sign('https://example.org'),'');
 for(const url of ['http://127.0.0.1','http://[::1]','file:///tmp/test','https://localhost'])assert.equal(s.sign(url),'');
 const r=request(s,'example.org');assert.ok(!r.url.href.includes('canary'));r.url.searchParams.set('domain','other.org');await r.run();assert.equal(r.res.status,403);
 const good=request(s,'example.org');await good.run();assert.equal(good.res.status,200);assert.deepEqual(good.res.body,png);
});
test('two resolver slots, domain coalescing and negative cache are independent of search',async()=>{
 let calls=0,release;const wait=new Promise(r=>release=r);const s=new FaviconService(adapter,key,{fetchImpl:async()=>{calls++;await wait;return new Response('',{headers:{'content-type':'text/html'}});}});
 const a=request(s,'example.org'),b=request(s,'example.org'),c=request(s,'second.org'),d=request(s,'third.org');
 const jobs=[a.run(),b.run(),c.run()];await d.run();assert.equal(calls,2);assert.equal(d.res.status,429);release();await Promise.all(jobs);assert.equal(a.res.status,204);await request(s,'example.org').run();assert.equal(calls,2);
});
test('favicon timeout ends independently after two seconds without retries',async()=>{
 let calls=0;const s=new FaviconService(adapter,key,{fetchImpl:async(_url,{signal})=>{calls++;return new Promise((_,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});setTimeout(()=>reject(Error('test deadline')),2200);});}});
 const r=request(s,'slow.org'),start=performance.now();await r.run();assert.equal(r.res.status,204);assert.ok(performance.now()-start<2150);assert.equal(calls,1);
});
