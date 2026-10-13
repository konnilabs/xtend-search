import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const stats=process.env.WEATHER_FIXTURE_STATS||'http://localhost:8094/weather-stats';
const browser=await chromium.launch(),runs=[];
try{
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  await page.addInitScript(()=>{
   window.weatherMetrics={ready:false,cls:0,shifts:[],start:null,end:null};
   new PerformanceObserver(list=>{for(const item of list.getEntries())if(window.weatherMetrics.ready){window.weatherMetrics.cls+=item.value;window.weatherMetrics.shifts.push({value:item.value,nodes:item.sources.map(s=>s.node?.className||s.node?.nodeName)});}}).observe({type:'layout-shift',buffered:false});
   window.addEventListener('xtend-search:stream',e=>{
    if(e.detail.event==='weather.location')requestAnimationFrame(()=>requestAnimationFrame(()=>{window.weatherMetrics.ready=true;window.weatherMetrics.start=performance.now();}));
    if(e.detail.status==='complete')window.weatherMetrics.end=performance.now();
   });
  });
  await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
  await page.evaluate(url=>window.XTendPage.visit(url,{cache:'reload'}),'/search?q=Fixture&categories=weather&language=all&time_range=&safesearch=1&location='+(100+width));
  await page.waitForFunction(()=>window.weatherMetrics.end!==null&&window.XTendPage.page.props['search.data'].weather?.hasForecast);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const metrics=await page.evaluate(()=>({...window.weatherMetrics,overflow:document.documentElement.scrollWidth>innerWidth+1}));
  const before=await (await fetch(stats)).json();let streams=0;
  page.on('request',r=>{if(r.url().endsWith('/search.weather.run'))streams++;});
  await page.getByRole('link',{name:'Web',exact:true}).click();
  await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='weather'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  const after=await (await fetch(stats)).json();
  assert.deepEqual(after,before,'Tab restore must not query geocoding, forecast, current or DWD');
  assert.equal(streams,0);assert.equal(metrics.overflow,false);
  runs.push({width,sectionCls:metrics.cls,shifts:metrics.shifts,streamAfterLayoutMs:metrics.end-metrics.start,restoredStreams:streams,providerCounterDelta:Object.fromEntries(Object.keys(after).map(k=>[k,after[k]-before[k]]))});
  await context.close();
 }
 const result={ok:runs.every(r=>r.sectionCls<0.001),scope:'Offline Docker fixtures. Layout shifts after the location surface is painted, including recent-input shifts. Same-tab history restore counts provider requests directly.',runs};
 await fs.writeFile(new URL('../../evidence/control-plane/0.6.0-weather-layout.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));assert(result.ok,'Weather sections must retain their geometry during streaming');
}finally{await browser.close();}
