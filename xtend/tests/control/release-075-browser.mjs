import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {VERSION} from '../../shared/version.mjs';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch(),checks=[],errors=[];
const out=new URL('../../evidence/control-plane/',import.meta.url);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const context=await browser.newContext({viewport:{width:1186,height:892},colorScheme:'dark'}),page=await context.newPage();
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
const complete=()=>page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete',null,{timeout:20000});
const idle=()=>page.waitForFunction(()=>!window.XTendPage.getRuntime().model.getState('search.activity').busy&&!document.querySelector('.search-button x-spinner'));
async function search(q,category='general'){
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 await page.locator('#search-input').fill(q);if(category==='general')await page.locator('.search-button').click();else await page.getByRole('link',{name:category==='images'?'Bilder':'Wetter',exact:true}).click();
}
try{
 // Local intent must not truncate the growing result list or lose its highlight.
 await page.addInitScript(()=>{
  window.selectionAudit={bad:[],frames:[]};
  new MutationObserver(()=>{
   const runtime=window.XTendPage?.getRuntime(),feedback=runtime?.model.getState('search.feedback');
   if(!feedback?.selected.length)return;
   const rows=runtime.model.getState('search.data').results;
   if(feedback.selected.every(selected=>rows.some(row=>row.reportKey===selected.id))&&(!document.querySelector('article.result[data-report-selected]')||!document.querySelector('.report-checkbox:checked')))
    window.selectionAudit.bad.push({count:rows.length,selected:feedback.selected.length});
  }).observe(document,{subtree:true,childList:true,attributes:true});
  addEventListener('xtend-search:stream',({detail})=>window.selectionAudit.frames.push({status:detail.status,count:document.querySelectorAll('article.result').length}));
 });
 await search('selection-stream-fixture');await page.waitForFunction(()=>document.querySelector('article.result')&&window.XTendPage.page.props['search.data'].stream?.phase==='partial');
 await page.locator('#report-start').click();await page.locator('.report-checkbox').first().click();
 await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.feedback').selected.length===1);
 const selectionPhase=await page.evaluate(()=>window.XTendPage.page.props['search.data'].stream.phase);assert.equal(selectionPhase,'partial');
 await complete();await idle();const audit=await page.evaluate(()=>window.selectionAudit);
 assert.deepEqual(audit.bad,[]);assert.equal(await page.locator('article.result[data-report-selected]').count(),1);
 assert.ok(audit.frames.slice(1).every((frame,index)=>frame.count>=audit.frames[index].count),'No local selection may roll back streamed rows');
 await page.locator('#report-cancel').click();await page.locator('#report-discard').click();
 checks.push('Early RMT report selection survives every stream update, without checkbox/highlight flicker or result-list rollback.');

 // Hold the real signed preview image, then the lazy native lightbox module.
 let holdImage=false,releaseImage,releaseModule;
 const imageGate=new Promise(resolve=>releaseImage=resolve),moduleGate=new Promise(resolve=>releaseModule=resolve);
 await page.route('**/media?*',async route=>{if(holdImage)await imageGate;await route.fulfill({status:200,contentType:'image/png',body:png});});
 await page.route('**/chunks/lightbox-*.mjs',async route=>{await moduleGate;await route.continue();});
 await search('preview-busy-fixture','images');await complete();await idle();holdImage=true;
 await page.locator('[data-preview-id]').first().click();await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.preview').imageLoading);
 await page.locator('.preview-busy-slot x-spinner').waitFor();
 const geometry=()=>page.locator('.preview-toolbar').evaluate(toolbar=>[...toolbar.children].map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
 const pendingGeometry=await geometry();
 const spinnerCenter=await page.locator('.preview-busy-slot').evaluate(slot=>{
  const a=slot.getBoundingClientRect(),b=slot.querySelector('x-spinner').shadowRoot.querySelector('[part~=root]').getBoundingClientRect();
  return {dx:Math.abs(a.x+a.width/2-b.x-b.width/2),dy:Math.abs(a.y+a.height/2-b.y-b.height/2)};
 });assert(spinnerCenter.dx<1&&spinnerCenter.dy<1,'The spinner glyph must be centered in its reserved slot: '+JSON.stringify(spinnerCenter));
 await page.evaluate(()=>{window.previewCls=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.previewCls+=e.value;}).observe({type:'layout-shift'});});
 holdImage=false;releaseImage();await page.waitForFunction(()=>!window.XTendPage.getRuntime().model.getState('search.preview').imageLoading);
 assert.deepEqual(await geometry(),pendingGeometry);assert.equal(await page.locator('.preview-busy-slot x-spinner').count(),0);
 const detailsBefore=await page.locator('.preview-details').boundingBox();
 await page.locator('#preview-expand').click();await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.preview').expansionLoading);
 await page.locator('.preview-busy-slot x-spinner').waitFor();assert.deepEqual(await geometry(),pendingGeometry);
 assert.equal(await page.locator('.preview-message').filter({hasText:'Vollbildansicht wird geladen'}).count(),0);
 assert.deepEqual(await page.locator('.preview-details').boundingBox(),detailsBefore);
 await page.screenshot({path:new URL(`${VERSION}-preview-busy.png`,out).pathname});
 releaseModule();await page.getByRole('dialog',{name:'Bildansicht',exact:true}).waitFor();
 await page.waitForFunction(()=>!window.XTendPage.getRuntime().model.getState('search.preview').expansionLoading);
 assert.equal(await page.locator('x-dialog#search-lightbox').count(),0);await page.keyboard.press('Escape');
 const previewCls=await page.evaluate(()=>window.previewCls);assert(previewCls<.001,'Loading transitions must not move the preview');
 checks.push('Image and lightbox loading use a reserved RMT XSpinner slot; title, arrows and details keep identical geometry; native fullscreen remains intact.');
 await page.unroute('**/chunks/lightbox-*.mjs');
 await page.getByRole('link',{name:'Über XTend.search',exact:true}).click();await page.locator('#search-about').waitFor();
 for(const colorScheme of ['dark','light']){
  await page.emulateMedia({colorScheme});const backdrop=await page.locator('#search-about').evaluate(host=>getComputedStyle(host.shadowRoot.querySelector('[part~=backdrop]')).backgroundColor);
  assert(!backdrop.includes('5, 18, 27'),'No legacy blue backdrop');
  await page.screenshot({path:new URL(`${VERSION}-about-${colorScheme}.png`,out).pathname});
 }
 await page.keyboard.press('Escape');checks.push('About backdrop follows the neutral warm palette in both schemes.');

 // Fault injection forwards real offline service frames and truncates/corrupts
 // the tail; the SDK still owns NDJSON parsing, sequence checks and cancellation.
 for(const fault of ['truncated','malformed']){
  await page.route('**/search.run',async route=>{
   const response=await route.fetch(),frames=(await response.text()).trim().split('\n').map(JSON.parse);
   const first=frames.findIndex(frame=>(frame.value??frame.delta)?.data?.results?.length>0);
   await route.fulfill({response,body:frames.slice(0,first+1).map(frame=>JSON.stringify(frame)).join('\n')+'\n'+(fault==='malformed'?'{invalid-json\n':'')});
  });
  await search('stream-fault-'+fault);await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='error');await idle();
  assert.ok(await page.locator('article.result').count());assert.equal(await page.evaluate(()=>window.XTendPage.page.props['search.data'].cache.cacheable),false);
  await page.unroute('**/search.run');
 }
 checks.push('Truncated and malformed NDJSON preserve already displayed results, terminate the spinner and forbid cache capture.');
 await search('old-generation-fixture');await page.waitForFunction(()=>document.querySelector('article.result')&&window.XTendPage.page.props['search.data'].stream?.phase==='partial');
 await page.locator('#search-input').fill('current-generation-fixture');await page.locator('.search-button').click();await complete();await idle();
 assert.ok((await page.locator('article.result h2').allTextContents()).every(title=>title.includes('current-generation-fixture')));
 checks.push('A newer direct search cancels stale frames; all final results belong to the current generation.');
 assert.deepEqual(errors,[]);const result={ok:true,checks,previewCls,scope:'Built candidate with isolated offline providers; explicit stream fault injection; no live queries or production settings.'};
 await fs.writeFile(new URL(`${VERSION}-stream-preview-browser.json`,out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await context.close();await browser.close();}
