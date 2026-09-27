import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
const base=process.env.TEST_BASE_URL || 'http://localhost:8080',out='evidence/tests/streaming';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});
const errors=[],external=[],resources={},rows=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url());});
const bodies=[];
page.on('response',response=>{if(response.request().resourceType()==='script')bodies.push(response.body().then(body=>{resources[new URL(response.url()).pathname]={raw:body.length,gzip:gzipSync(body).length};}).catch(()=>{}));});
try{
 await page.addInitScript(()=>{
  window.__frames=[];window.__firstResult=null;
  window.addEventListener('xtend-search:stream',({detail})=>window.__frames.push({...detail,time:performance.now()}));
  const measure=()=>{const d=window.XTendPage?.page?.props?.['search.data'];if(window.__started && !window.__firstResult && d?.q===window.__expected?.q && d?.category===window.__expected?.category && document.querySelector('article.result'))window.__firstResult=performance.now();};
  new MutationObserver(measure).observe(document,{subtree:true,childList:true});
  window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='navigate')measure();});
 });
 await page.goto(base);await page.waitForFunction(()=>window.XTendPage);await Promise.all(bodies);
 const initialGzip=Object.values(resources).reduce((sum,r)=>sum+r.gzip,0);
 await page.evaluate(()=>window.__documentIdentity='live-stream');
 for(const [q,category] of [['ubuntu','general'],['open source','images']]){
  await page.evaluate(async({q,category})=>{window.__frames=[];window.__firstResult=null;window.__expected={q,category};window.__started=performance.now();await window.XTendPage.visit('/search?'+new URLSearchParams({q,categories:category}));},{q,category});
  await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete',null,{timeout:25000});
  await page.waitForFunction(()=>window.__frames.some(f=>f.status==='disposed'));
  const result=await page.evaluate(()=>{const d=window.XTendPage.page.props['search.data'];return {query:d.q,category:d.category,firstResultDomMs:window.__firstResult-window.__started,frames:window.__frames.map(f=>({type:f.status,ms:f.time-window.__started,sequence:f.sequence})),transport:window.__frames.find(f=>f.status==='disposed')?.transport,results:d.results.length,fixture:d.fixture,warnings:d.warnings.map(w=>w.message),sameDocument:window.__documentIdentity==='live-stream'};});
  assert.equal(result.fixture,false);assert(result.results>0);assert.equal(result.sameDocument,true);assert.equal(result.transport.loader.counters.accepted,1);assert.equal(result.transport.loader.counters.attached,1);assert(result.frames.some(f=>f.type==='delta'));
  if(category==='images'){
   await page.waitForFunction(()=>[...document.querySelectorAll('img[data-result-image]')].some(img=>img.naturalWidth>0 && img.getAttribute('src')?.startsWith('/image_proxy?')),null,{timeout:15000});
   result.loadedThumbnails=await page.locator('img[data-result-image]').evaluateAll(imgs=>imgs.filter(img=>img.naturalWidth>0 && img.getAttribute('src')?.startsWith('/image_proxy?')).length);
  }
  rows.push(result);
  await page.screenshot({path:`${out}/live-${category}.png`});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await Promise.all(bodies);
 const evidence={timestamp:new Date().toISOString(),base,note:'Single unthrottled live Chromium runs, actual external engines; no claim of statistical performance.',initialJavaScriptGzip:initialGzip,resources,rows,errors,external};
 fs.writeFileSync(`${out}/live.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
