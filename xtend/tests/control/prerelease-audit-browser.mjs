import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch(),runs=[];
try{
 for(const [width,throttled] of [[320,false],[390,false],[1440,false],[1920,false],[3840,false],[390,true]]){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:'dark'}),page=await context.newPage(),errors=[],requests={search:0,weather:0,context:0};
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.endsWith('/search.run'))requests.search++;if(path.endsWith('/search.weather.run'))requests.weather++;if(path.endsWith('/search.cache.context'))requests.context++;});
  if(throttled){const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:120,downloadThroughput:150000,uploadThroughput:75000});}
  await page.addInitScript(()=>{
   window.audit={started:null,headerMs:null,first:null,complete:null,bootstrapCls:0,lcpMs:null,cls:0,allShifts:0,shifts:[],longTasks:[],frames:[]};
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.audit.lcpMs=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
   new MutationObserver(()=>{if(window.audit.started!==null&&window.audit.headerMs===null&&document.querySelector('#search-shell')?.dataset.view==='results')window.audit.headerMs=performance.now()-window.audit.started;}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-view']});
   new PerformanceObserver(list=>{for(const e of list.getEntries()){if(window.audit.started===null){if(!e.hadRecentInput)window.audit.bootstrapCls+=e.value;continue;}window.audit.allShifts+=e.value;if(!e.hadRecentInput)window.audit.cls+=e.value;window.audit.shifts.push({atMs:e.startTime-window.audit.started,value:e.value,recentInput:e.hadRecentInput,nodes:e.sources.map(s=>({tag:s.node?.tagName,id:s.node?.id,className:typeof s.node?.className==='string'?s.node.className:'',before:s.previousRect.toJSON(),after:s.currentRect.toJSON()}))});}}).observe({type:'layout-shift',buffered:false});
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.audit.longTasks.push({startMs:e.startTime,durationMs:e.duration});}).observe({type:'longtask',buffered:true});
   addEventListener('xtend-search:stream',({detail})=>{if(window.audit.started===null)return;const n=document.querySelectorAll('article.result').length,t=performance.now()-window.audit.started;window.audit.frames.push({elapsedMs:t,status:detail.status,event:detail.event||null,resultCount:n});if(n)window.audit.first??=t;if(detail.status==='complete')window.audit.complete=t;});
  });
  // Hold icons beyond search completion; neither paint nor terminal frame may wait for them.
  await page.route('**/favicon?*',async route=>{await new Promise(resolve=>setTimeout(resolve,4000));await route.fulfill({status:204}).catch(()=>{});});
  await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
  const initial=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return {ttfbMs:n.responseStart-n.requestStart,domContentLoadedMs:n.domContentLoadedEventEnd,resumeReadyMs:performance.now(),fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,lcpMs:window.audit.lcpMs,cls:window.audit.bootstrapCls,jsEncodedBytes:performance.getEntriesByType('resource').filter(e=>/\.(mjs|js)(\?|$)/.test(e.name)).reduce((sum,e)=>sum+e.encodedBodySize,0)};});
  assert.ok(initial.cls<0.01,'SSR/resume must retain initial geometry: '+JSON.stringify(initial));
  await page.locator('#search-input').fill('prerelease audit '+width);await page.evaluate(()=>window.audit.started=performance.now());await page.locator('.search-button').click();
  await page.waitForFunction(()=>window.audit.complete!==null);await page.waitForFunction(()=>!document.querySelector('.search-button x-spinner'));
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const stream=await page.evaluate(()=>({...window.audit,overflow:document.documentElement.scrollWidth>innerWidth+1,weatherAssetRequests:performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/xtend/weather/')).length}));
  await fs.writeFile('/tmp/xtend060-audit-case.json',JSON.stringify({width,throttled,initial,stream},null,2));
  assert.ok(stream.headerMs<500,'Header move must start within the user interaction, before a slow page response');assert.ok(stream.first>0&&stream.first<stream.complete-500,'First batch must paint well before completion');assert.equal(stream.frames.at(-1).status,'complete');assert.equal(stream.frames.at(-1).resultCount,10);assert.ok(stream.complete<4000+(throttled?1800:0),'Slow favicon must not hold search completion');assert.ok(stream.cls<0.01,'Unexpected content movement: '+JSON.stringify(stream));assert.equal(stream.overflow,false);assert.equal(stream.weatherAssetRequests,0);
  await page.unroute('**/favicon?*');
  await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='images'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  const before={...requests},start=Date.now();await page.getByRole('link',{name:'Web',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  const restore={elapsedMs:Date.now()-start,searchStreamDelta:requests.search-before.search,metadataDelta:requests.context-before.context};assert.equal(restore.searchStreamDelta,0);assert.equal(restore.metadataDelta,1);
  assert.deepEqual(errors,[]);runs.push({width,throttled,initial,stream,restore,errors});await context.close();
 }
 const report={ok:true,scope:'Built Docker image with offline 100/700/2500ms provider fixtures; 4s favicon delay; synthetic 120ms/1.2Mbit mobile link. CLS excludes recent-input shifts per Web Vitals; all shift values are retained separately. Long tasks include bootstrap. No production latency claim or user queries/URLs retained.',runs};
 await fs.writeFile(new URL('../../evidence/control-plane/0.6.0-prerelease-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:true,runs:runs.map(r=>({width:r.width,throttled:r.throttled,firstMs:r.stream.first,completeMs:r.stream.complete,cls:r.stream.cls,restore:r.restore,longTaskCount:r.stream.longTasks.length}))}));
}finally{await browser.close();}
