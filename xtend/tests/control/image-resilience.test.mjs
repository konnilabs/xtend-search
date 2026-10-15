import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {projectResultThumbnails,IMAGE_PLACEHOLDER} from '../../frontend/image-resilience.mjs';
import {MediaResources} from '../../server/control/media-resources.mjs';
import {MediaProxy} from '../../server/control/media.mjs';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
test('broken thumbnails use one signed original, then settle; unsigned alternatives are rejected',()=>{
 const row={id:'one',thumbnail:'/media?thumb',thumbnailKey:'key',thumbnailAlt:'Image',previewSrc:'/media?original'},failed=new Set(['/media?thumb']);
 const [alternative]=projectResultThumbnails([row],failed);assert.equal(alternative.thumbnail,'/media?original');assert.equal(alternative.thumbnailFailed,false);assert.equal(alternative.thumbnailFallback,true);assert.equal(row.thumbnail,'/media?thumb');
 failed.add('/media?original');assert.equal(projectResultThumbnails([row],failed)[0].thumbnail,IMAGE_PLACEHOLDER);
 failed.delete('/media?original');assert.equal(projectResultThumbnails([row],failed)[0].thumbnail,'/media?original');
 assert.equal(projectResultThumbnails([{...row,previewSrc:'https://external.test/direct'}],failed)[0].thumbnail,IMAGE_PLACEHOLDER);
});
test('media bursts queue, deduplicate and reuse bytes without extra upstream requests',async()=>{
 const pool=new MediaResources({maxActive:2,maxQueued:4}),signal=new AbortController().signal,releases=[];let running=0,peak=0,loads=0;
 const load=async()=>{loads++;peak=Math.max(peak,++running);await new Promise(resolve=>releases.push(resolve));running--;return {body:Buffer.from('image'),type:'image/png'};};
 const work=['one','one','two','three','four'].map(key=>pool.load(key,load,signal));await turn();assert.equal(loads,2);assert.equal(pool.queue.length,2);
 releases.splice(0).forEach(resolve=>resolve());await turn();releases.splice(0).forEach(resolve=>resolve());const result=await Promise.all(work);assert.equal(loads,4);assert.equal(peak,2);assert.equal(result.length,5);
 await pool.load('one',load,signal);assert.equal(loads,4);assert.equal(pool.pending.size,0);assert.equal(pool.active,0);
});
test('media cache TTL, byte/entry limits, failure eviction and cancellation remain bounded',async()=>{
 let now=0;const pool=new MediaResources({maxActive:1,maxQueued:1,maxEntries:2,maxBytes:5,ttlMs:10,now:()=>now}),signal=new AbortController().signal;
 const image=async()=>({body:Buffer.from('abc'),type:'image/png'});
 await pool.load('one',image,signal);await pool.load('two',image,signal);assert.equal(pool.cache.size,1);assert.equal(pool.bytes,3);now=11;let loads=0;await pool.load('two',async()=>{loads++;return image();},signal);assert.equal(loads,1);
 for(let i=0;i<2;i++)await assert.rejects(pool.load('failed',async()=>{throw Error('unavailable');},signal),/unavailable/);assert.equal(pool.cache.has('failed'),false);
 const a=new AbortController(),b=new AbortController();let release,aborted=false;
 const first=pool.load('shared',async s=>{s.addEventListener('abort',()=>aborted=true);await new Promise(r=>release=r);return image();},a.signal),second=pool.load('shared',image,b.signal);await turn();a.abort();await assert.rejects(first);assert.equal(aborted,false);release();await second;
 const hold=new AbortController(),queued=new AbortController();let unblock;
 const busy=pool.load('busy',async()=>{await new Promise(r=>unblock=r);return image();},hold.signal);await turn();const waiting=pool.load('queued',image,queued.signal);await assert.rejects(pool.load('overflow',image,signal),/media_busy/);queued.abort();await assert.rejects(waiting);assert.equal(pool.queue.length,0);unblock();await busy;
});
test('proxy cache still verifies signatures and expiry before returning cached media',async()=>{
 const proxy=new MediaProxy('fixture');let loads=0;proxy.fetchImage=async()=>{loads++;return {body:Buffer.from('fixture'),type:'image/png'};};
 const signed=new URL(proxy.sign('https://images.example.test/file.png'),'http://fixture');
 async function request(url){const res=new EventEmitter();Object.assign(res,{headersSent:false,destroyed:false,writeHead(status,headers){this.status=status;this.headers=headers;this.headersSent=true;},end(body){this.body=body;},destroy(){this.destroyed=true;}});await proxy.handle({},res,url);return res;}
 assert.equal((await request(signed)).status,200);assert.equal((await request(signed)).status,200);assert.equal(loads,1);
 const wrong=new URL(signed);wrong.searchParams.set('h','ä'.repeat(43));assert.equal((await request(wrong)).status,403);
 const expired=new URL(signed);expired.searchParams.set('exp','1');assert.equal((await request(expired)).status,403);assert.equal(loads,1);
});
