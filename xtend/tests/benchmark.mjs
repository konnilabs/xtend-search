import {chromium} from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import {gzipSync,brotliCompressSync} from 'node:zlib';
const browser=await chromium.launch();
const rows=[],resources={},runs=Number(process.env.BENCH_RUNS || 30),warmups=5;
const x=process.env.TEST_BASE_URL || 'http://127.0.0.1:8080',u=process.env.BASELINE_URL || 'http://127.0.0.1:8094';
async function configure(page,profile){
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Network.enable');
 if(profile==='slow'){await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:1250000,uploadThroughput:625000});}
 await page.addInitScript(()=>{
  window.__perf={cls:0,lcp:0,longTasks:0,capture:0,ready:0,pending:0,commit:0};
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__perf.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(list=>{window.__perf.lcp=list.getEntries().at(-1)?.startTime || 0;}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{window.__perf.longTasks+=list.getEntries().reduce((s,e)=>s+e.duration,0);}).observe({type:'longtask',buffered:true});
  window.addEventListener('xtend-page:capturing',()=>window.__perf.capture=performance.now());window.addEventListener('xtend-page:ready',()=>window.__perf.ready=performance.now());
  window.addEventListener('xtend-page:event',({detail:e})=>{if(e.type==='pending')window.__perf.pending=performance.now();if(e.type==='navigate')window.__perf.commit=performance.now();});
 });
 return cdp;
}
for(const profile of ['desktop','slow'])for(const cache of ['cold','warm'])for(const variant of ['U','X0','X1']){
 const context=await browser.newContext({javaScriptEnabled:variant!=='X0',viewport:{width:1440,height:1000}});const page=await context.newPage();const cdp=await configure(page,profile);
 const url=(variant==='U'?u:x)+'/search?q=benchmark50&categories=general&language=all&safesearch=1';
 if(variant==='X1' && profile==='desktop'&&cache==='cold')page.on('response',async response=>{
  if(response.request().resourceType()!=='script')return;const key=new URL(response.url()).pathname;if(resources[key])return;try{const b=await response.body();resources[key]={raw:b.length,gzip:gzipSync(b).length,brotli:brotliCompressSync(b).length};}catch{}
 });
 for(let i=-warmups;i<runs;i++){
  if(cache==='cold')await cdp.send('Network.clearBrowserCache');
  await page.goto(url,{waitUntil:'load'});if(variant==='X1')await page.waitForFunction(()=>window.XTendPage);await page.waitForTimeout(120);
  const data=await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0],entries=performance.getEntriesByType('resource');return {...window.__perf,ttfb:nav.responseStart,documentEnd:nav.responseEnd,domReady:nav.domContentLoadedEventEnd,htmlBytes:nav.encodedBodySize,transferred:nav.transferSize+entries.reduce((s,e)=>s+e.transferSize,0),requests:entries.length+1,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,resume:document.querySelector('[data-rmt-resume-status]')?.getAttribute('data-rmt-resume-status') || null,results:document.querySelectorAll('article').length};});
  if(i>=0)rows.push({profile,cache,variant,iteration:i,...data});
 }
 console.log(JSON.stringify({finished:{profile,cache,variant,runs}}));await context.close();
}
// Warm SPA navigation: same 50-row set, URL alternates without document replacement.
for(const profile of ['desktop','slow']){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();await configure(page,profile);await page.goto(x+'/search?q=benchmark50');await page.waitForFunction(()=>window.XTendPage);
 for(let i=-warmups;i<runs;i++){
  const query='benchmark50';const language=i%2===0?'de':'all';
  const data=await page.evaluate(async({query,language})=>{
   const start=performance.now();const before=performance.getEntriesByType('navigation').length;
   await window.XTendPage.visit('/search?'+new URLSearchParams({q:query,language,categories:'general',safesearch:'1'}));
   const end=performance.now();const responses=performance.getEntriesByType('resource').filter(r=>r.initiatorType==='fetch');const last=responses.at(-1);
   return {duration:end-start,pending:window.__perf.pending-start,commitAfterResponse:window.__perf.commit-(last?.responseEnd||end),documents:performance.getEntriesByType('navigation').length-before,results:document.querySelectorAll('article').length};
  },{query,language});if(i>=0)rows.push({profile,cache:'warm',variant:'navigation',iteration:i,...data});
 }
 await context.close();console.log(JSON.stringify({finished:{profile,variant:'navigation',runs}}));
}
await browser.close();
const groups={};for(const row of rows){const key=[row.profile,row.cache,row.variant].join('/');(groups[key] ||= []).push(row);}
const summary={};const quantile=(a,p)=>a[Math.ceil(p*a.length)-1];
for(const [key,group] of Object.entries(groups)){
 summary[key]={runs:group.length};for(const metric of ['ttfb','lcp','fcp','cls','htmlBytes','transferred','ready','longTasks','duration','pending','commitAfterResponse']){
  const a=group.map(r=>r[metric]).filter(Number.isFinite).sort((a,b)=>a-b);if(a.length)summary[key][metric]={median:quantile(a,.5),p75:quantile(a,.75),p95:quantile(a,.95),min:a[0],max:a.at(-1)};
 }
}
const out={timestamp:new Date().toISOString(),environment:{os:os.release(),cpus:os.cpus()[0].model,node:process.version,browser:browser.version(),transport:'local processes, same compression gateway, fixture50/40ms, no concurrent build intended',warmups,runs},summary,resources,rows};
fs.writeFileSync('evidence/tests/performance.json',JSON.stringify(out,null,2));console.log(JSON.stringify(summary));
