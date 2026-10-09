import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
const browser=await chromium.launch(),runs=[];
try{
 for(const [variant,base] of [['legacy-xscaler','http://localhost:8097'],['standalone-conservative','http://localhost:8093'],['standalone-adaptive','http://localhost:8093'],['standalone-throttled','http://localhost:8093'],['upstream-ssr','http://localhost:8097/classic']]){
  if(variant==='standalone-adaptive'||variant==='standalone-throttled'){
   const config=await browser.newPage();await config.goto('http://localhost:8093/admin');await config.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).or(config.getByRole('link',{name:'Anmelden mit CCS Account',exact:true})).click();await config.getByRole('link',{name:'administrator',exact:true}).click();await config.waitForFunction(()=>window.XTendPage);await config.locator('#routing-form select').selectOption(variant==='standalone-adaptive'?'adaptive':'conservative');await config.getByRole('button',{name:'Betriebsmodus speichern'}).click();await config.waitForFunction(mode=>window.XTendPage.getRuntime().model.getState('admin.data').mode===mode,variant==='standalone-adaptive'?'adaptive':'conservative');await config.close();
  }
  for(let i=0;i<3;i++){
   const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),query='benchmark '+i;
   if(variant==='standalone-throttled'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:200000,uploadThroughput:93750});}
   await page.addInitScript(query=>{
    window.probe={first:null,cls:0,longTasks:[],start:performance.timeOrigin};
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.probe.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.probe.longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});
    new MutationObserver(()=>{if(window.probe.first!==null)return;const results=[...document.querySelectorAll('article.result')];if(results.some(r=>r.textContent.includes(query)))requestAnimationFrame(()=>requestAnimationFrame(()=>{window.probe.first??=Date.now();}));}).observe(document,{childList:true,subtree:true});
   },query);
   console.log('measuring',variant,i+1);let start;
   if(variant==='upstream-ssr'){
    start=Date.now();await page.goto(base+'/search?'+new URLSearchParams({q:query,categories:'general',language:'all',safesearch:'1'}),{waitUntil:'domcontentloaded'});
   }else{
    await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage);await page.locator('#search-input').fill(query);start=Date.now();await page.getByRole('button',{name:'Suchen',exact:true}).click();
    await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete',null,{timeout:15000});
   }
   const complete=Date.now();assert.ok(await page.locator('article.result').count(),variant+' has no results: '+await page.locator('body').innerText());await page.waitForFunction(()=>window.probe.first!==null);const value=await page.evaluate(()=>({...window.probe,jsResources:performance.getEntriesByType('resource').filter(e=>/\.(?:mjs|js)(?:\?|$)/.test(e.name)).map(e=>({path:new URL(e.name).pathname,encoded:e.encodedBodySize,decoded:e.decodedBodySize}))})),results=await page.locator('article.result').count();assert.ok(results>0);
   runs.push({variant,run:i+1,firstVisibleMs:value.first-start,completeMs:complete-start,resultCount:results,cls:value.cls,longTasksMs:value.longTasks,initialJsGzipBytes:value.jsResources.reduce((n,e)=>n+e.encoded,0),initialJsDecodedBytes:value.jsResources.reduce((n,e)=>n+e.decoded,0),publicLoadedAdminAssets:value.jsResources.some(e=>e.path.includes('/admin/')),dispatchesPerSearch:3,fixtureDelaysMs:[100,700,2500]});await context.close();
  }
 }
 const report={date:new Date().toISOString(),browser:browser.version(),node:process.version,cpu:os.cpus()[0].model,os:os.release(),viewport:'1440x1000',sampleCount:3,scope:'Local Docker; identical three offline engines, no live-provider requests. Standalone uses flushing gzip proxy. Legacy uses its original gzip gateway; classic shares that gateway. Separate document/home bootstrap before every measured search. Throttled variant: CPU x4, 80ms emulated latency, 1.6Mbit/s down / 750Kbit/s up; other profiles unthrottled. Adaptive pool contains the same three engines; this compares overhead, not wider-pool quality gains.',runs,unmeasured:['Production proxy/network and live-provider quality','Full adapter-to-paint p95 budget','Full planner/gateway p95 budget','Mobile hardware and screen reader validation','Long-duration resource/soak test']};
 await fs.writeFile(new URL('../../evidence/control-plane/performance.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
