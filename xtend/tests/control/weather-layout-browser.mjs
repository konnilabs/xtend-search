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
 const readingAlignmentErrors=[];
 for(const [index,cell] of [...hours,...days].entries()){
  const readings=[...cell.querySelectorAll('.weather-temperature-reading,.weather-reading')];
  const positions=readings.map(row=>{const left=row.getBoundingClientRect().left;return ['x-icon','.weather-value','.weather-temperature-unit,.weather-reading-unit'].map(selector=>row.querySelector(selector)?.getBoundingClientRect().left-left);});
  if(positions.some(p=>p.some(n=>!Number.isFinite(n)))||positions.some(p=>p.some((n,i)=>Math.abs(n-positions[0][i])>.5)))readingAlignmentErrors.push(index);
 }

 return {readingAlignmentErrors,board:rect(board),sections:[...board.querySelectorAll(':scope>section')].map(e=>({name:e.className,...rect(e)})),hours:hours.length,days:days.length,hourRows:rows(hours),dayRows:rows(days),metricRows:rows(metrics),hourScrollable:hourStrip.scrollWidth>hourStrip.clientWidth+1,overflow:document.documentElement.scrollWidth>innerWidth+1,clippedText:[...board.querySelectorAll('.weather-day>*,.weather-hour>*,.weather-now>p,.weather-metric>*')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className||e.tagName)};
 });}
function assertLayout(metrics){
 assert.equal(metrics.overflow,false,'Only the hourly strip may scroll horizontally');
 assert.deepEqual(metrics.clippedText,[],'Weather values and long weekday labels must fit');
 assert.deepEqual(metrics.readingAlignmentErrors,[],'Icons, values and units must use identical column offsets');
 assert.equal(metrics.hours,24);assert.equal(metrics.days,7);
 assert.equal(metrics.hourRows,metrics.board.width>=600?2:1);
 assert.equal(metrics.dayRows,metrics.board.width>=900?1:7);
 assert.equal(metrics.metricRows,metrics.board.width>=1100?1:metrics.board.width>=600?2:4);
 if(metrics.board.width>=800)for(const name of ['weather-daily','weather-metrics'])assert(Math.abs(metrics.sections.find(s=>s.name===name).width-metrics.board.width)<1,'Forecast and metrics must use the full board width');
 if(metrics.board.width<600)assert(metrics.hourScrollable,'Mobile hours remain touch-scrollable');
 if(metrics.board.width>=1400)assert.equal(metrics.hourScrollable,false,'All twelve hourly slots must fit on wide boards');
}
async function assertUnits(page){
 await page.waitForFunction(()=>document.querySelector('#weather-unit-toggle')?.shadowRoot?.querySelector('input'));
 const before=await layout(page),url=page.url(),providerBefore=await(await fetch(stats)).json();let weatherStreams=0;
 const count=r=>{if(r.url().endsWith('/search.weather.run'))weatherStreams++;};page.on('request',count);
 await page.evaluate(()=>{window.weatherNode=document.querySelector('.weather-content');window.weatherMetrics.cls=0;window.weatherMetrics.shifts=[];});
 const ratio=async()=>page.evaluate(()=>{
  const luminance=color=>{const c=color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const control=document.querySelector('#weather-unit-toggle'),root=control.shadowRoot;return ['c','f'].map((unit,i)=>{
   const foreground=luminance(getComputedStyle(document.querySelector('.weather-unit-'+unit)).color);
   const background=luminance(getComputedStyle(root.querySelector(control.checked===(i===1)?'.thumb':'.track')).backgroundColor);
   return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
  });
 });
 const contrasts=[];
 for(const colorScheme of ['light','dark']){
  await page.emulateMedia({colorScheme});
  assert.equal(await page.locator('.weather-temperature-unit').first().textContent(),' °C');contrasts.push(...await ratio());
  await page.locator('#weather-unit-toggle').click();
  await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.weatherUi').fahrenheit===true&&document.querySelector('#weather-unit-tools').hasAttribute('data-fahrenheit')&&document.querySelector('.weather-temperature .weather-value').textContent==='64.4');
  assert.match(await page.locator('.weather-apparent').textContent(),/62\.6 °F/);
  assert.equal(await page.locator('.weather-low .weather-value').first().textContent(),'46.4');
  assert.equal(await page.locator('.weather-high .weather-value').first().textContent(),'66.2');contrasts.push(...await ratio());
  assert.deepEqual(await layout(page),before,'Unit changes preserve card and forecast geometry');
  await page.getByRole('switch',{name:'Fahrenheit verwenden (aus: Celsius)'}).press('Space');
  await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.weatherUi').fahrenheit===false&&!document.querySelector('#weather-unit-tools').hasAttribute('data-fahrenheit')&&document.querySelector('.weather-temperature-unit').textContent===' °C');
 }
 assert(Math.min(...contrasts)>=4.5,'Both unit labels must meet 4.5:1 in both palettes and states: '+JSON.stringify(contrasts));
 assert.equal(await page.locator('.weather-temperature-reading x-icon[name=temperature]').count(),24);
 assert.equal(await page.locator('.weather-low x-icon[name=temperature-low]').count(),7);assert.equal(await page.locator('.weather-high x-icon[name=temperature-high]').count(),7);assert.equal(await page.locator('.weather-rain x-icon[name=rain-probability]').count(),31);
 // Select Fahrenheit for the subsequent real history/cache round-trip.
 await page.locator('#weather-unit-toggle').click();await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.weatherUi').fahrenheit===true);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 // Text glyphs necessarily change; recent user-input shifts are excluded from
 // Core Web Vitals CLS. Card/row geometry is checked separately above.
 const unitShifts=await page.evaluate(()=>window.weatherMetrics.shifts),unitCls=unitShifts.filter(s=>!s.recentInput).reduce((sum,s)=>sum+s.value,0);assert.equal(unitCls,0);
 assert(await page.evaluate(()=>document.querySelector('.weather-content')===window.weatherNode),'Unit changes must not replace the weather surface');
 assert.equal(page.url(),url);assert.equal(weatherStreams,0);assert.deepEqual(await(await fetch(stats)).json(),providerBefore);
 page.off('request',count);return {unitCls,recentInputGlyphShifts:unitShifts.filter(s=>s.recentInput).reduce((sum,s)=>sum+s.value,0),weatherStreams,minTextContrast:Math.min(...contrasts)};
}
const browser=await chromium.launch(),runs=[];
try{
 for(const width of [320,390,700,900,1000,1024,1440,1920,3840]){
  const context=await browser.newContext({colorScheme:'dark',viewport:{width,height:1000}}),page=await context.newPage();
  await page.addInitScript(()=>{
   window.weatherMetrics={ready:false,cls:0,shifts:[],start:null,end:null};
   new PerformanceObserver(list=>{for(const item of list.getEntries())if(window.weatherMetrics.ready){window.weatherMetrics.cls+=item.value;window.weatherMetrics.shifts.push({value:item.value,recentInput:item.hadRecentInput,nodes:item.sources.map(s=>s.node?.className||s.node?.nodeName)});}}).observe({type:'layout-shift',buffered:false});
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
  const units=await assertUnits(page);
  const before=await (await fetch(stats)).json();let streams=0;
  page.on('request',r=>{if(r.url().endsWith('/search.weather.run'))streams++;});
  await page.getByRole('link',{name:'Web',exact:true}).click();
  await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete'&&!document.querySelector('#weather-unit-tools'));
  assert.equal(await page.locator('#weather-unit-tools').count(),0);await page.locator('#report-start').waitFor();
  await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='weather'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  const after=await (await fetch(stats)).json();
  assert.deepEqual(after,before,'Tab restore must not query geocoding, forecast, current or DWD');
  assert.equal(streams,0);
  await page.waitForFunction(()=>document.querySelector('.weather-temperature-unit')?.textContent===' °F');
  await page.locator('.wordmark').click();await page.waitForFunction(()=>document.querySelector('#search-shell').dataset.view==='home'&&!document.querySelector('#weather-unit-tools,#report-start'));
  assert.equal(await page.locator('#weather-unit-tools,#report-start').count(),0);
  runs.push({width,sectionCls:metrics.cls,shifts:metrics.shifts,geometry,units,streamAfterLayoutMs:metrics.end-metrics.start,restoredStreams:streams,providerCounterDelta:Object.fromEntries(Object.keys(after).map(k=>[k,after[k]-before[k]]))});
  await context.close();
 }
 const noJs=[];
 for(const width of [320,390,1440,3840]){
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:1000}}),page=await context.newPage();
  await page.goto(base+'/search?q=Fixture&categories=weather&language=all&time_range=&safesearch=1&location=1');
  const geometry=await layout(page);assertLayout(geometry);assert.equal(await page.locator('.weather-temperature-unit').first().textContent(),' °C');noJs.push({width,geometry});await context.close();
 }
 const result={ok:runs.every(r=>r.sectionCls<0.001),scope:'Offline Docker fixtures. Responsive card geometry in light/dark schemes and without JavaScript. Layout shifts after the location surface is painted, including recent-input shifts. Same-tab history restore counts provider requests directly.',runs,noJs};
 await fs.writeFile(new URL('../../evidence/control-plane/0.6.0-weather-layout.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));assert(result.ok,'Weather sections must retain their geometry during streaming');
}finally{await browser.close();}
