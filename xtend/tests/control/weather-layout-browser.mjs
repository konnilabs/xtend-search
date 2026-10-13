import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const stats=process.env.WEATHER_FIXTURE_STATS||'http://localhost:8094/weather-stats';
async function layout(page){return page.evaluate(()=>{
 const rect=e=>({x:e.offsetLeft,y:e.offsetTop,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height});
 const board=document.querySelector('.weather-content'),hours=[...document.querySelectorAll('.weather-hour')],days=[...document.querySelectorAll('.weather-day')],metrics=[...document.querySelectorAll('.weather-metric')];
 const rows=items=>new Set(items.map(e=>Math.round(e.offsetTop))).size;
 const hourStrip=document.querySelector('.weather-hours');
 return {board:rect(board),sections:[...board.querySelectorAll(':scope>section')].map(e=>({name:e.className,...rect(e)})),hours:hours.length,days:days.length,hourRows:rows(hours),dayRows:rows(days),metricRows:rows(metrics),hourScrollable:hourStrip.scrollWidth>hourStrip.clientWidth+1,overflow:document.documentElement.scrollWidth>innerWidth+1,clippedText:[...board.querySelectorAll('.weather-day>*,.weather-hour>*,.weather-now>p,.weather-metric>*')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className||e.tagName)};
 });}
function assertLayout(metrics){
 assert.equal(metrics.overflow,false,'Only the hourly strip may scroll horizontally');
 assert.deepEqual(metrics.clippedText,[],'Weather values and long weekday labels must fit');
 assert.equal(metrics.hours,24);assert.equal(metrics.days,7);
 assert.equal(metrics.hourRows,metrics.board.width>=600?2:1);
 assert.equal(metrics.dayRows,metrics.board.width>=900?1:7);
 assert.equal(metrics.metricRows,metrics.board.width>=1100?1:metrics.board.width>=600?2:4);
 if(metrics.board.width>=800)for(const name of ['weather-daily','weather-metrics'])assert(Math.abs(metrics.sections.find(s=>s.name===name).width-metrics.board.width)<1,'Forecast and metrics must use the full board width');
 if(metrics.board.width<600)assert(metrics.hourScrollable,'Mobile hours remain touch-scrollable');
}
const browser=await chromium.launch(),runs=[];
try{
 for(const width of [320,390,700,900,1000,1024,1440,1920,3840]){
  const context=await browser.newContext({colorScheme:'dark',viewport:{width,height:1000}}),page=await context.newPage();
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
  const metrics=await page.evaluate(()=>window.weatherMetrics),geometry=await layout(page);assertLayout(geometry);
  if(process.env.WEATHER_LAYOUT_SCREENSHOTS)await page.screenshot({path:process.env.WEATHER_LAYOUT_SCREENSHOTS+'/weather-'+width+'.png',fullPage:true});
  await page.emulateMedia({colorScheme:'light'});const lightGeometry=await layout(page);assertLayout(lightGeometry);
  assert.deepEqual(lightGeometry,geometry,'The color scheme must not change weather layout');
  const before=await (await fetch(stats)).json();let streams=0;
  page.on('request',r=>{if(r.url().endsWith('/search.weather.run'))streams++;});
  await page.getByRole('link',{name:'Web',exact:true}).click();
  await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='weather'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  const after=await (await fetch(stats)).json();
  assert.deepEqual(after,before,'Tab restore must not query geocoding, forecast, current or DWD');
  assert.equal(streams,0);
  runs.push({width,sectionCls:metrics.cls,shifts:metrics.shifts,geometry,streamAfterLayoutMs:metrics.end-metrics.start,restoredStreams:streams,providerCounterDelta:Object.fromEntries(Object.keys(after).map(k=>[k,after[k]-before[k]]))});
  await context.close();
 }
 const noJs=[];
 for(const width of [320,390,1440,3840]){
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:1000}}),page=await context.newPage();
  await page.goto(base+'/search?q=Fixture&categories=weather&language=all&time_range=&safesearch=1&location=1');
  const geometry=await layout(page);assertLayout(geometry);noJs.push({width,geometry});await context.close();
 }
 const result={ok:runs.every(r=>r.sectionCls<0.001),scope:'Offline Docker fixtures. Responsive card geometry in light/dark schemes and without JavaScript. Layout shifts after the location surface is painted, including recent-input shifts. Same-tab history restore counts provider requests directly.',runs,noJs};
 await fs.writeFile(new URL('../../evidence/control-plane/0.6.0-weather-layout.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));assert(result.ok,'Weather sections must retain their geometry during streaming');
}finally{await browser.close();}
