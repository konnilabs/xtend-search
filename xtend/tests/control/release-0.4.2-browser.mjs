import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const version=JSON.parse(await fs.readFile(new URL('../../package.json',import.meta.url))).version;
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const out=new URL('../../evidence/control-plane/',import.meta.url),checks=[],errors=[];
const browser=await chromium.launch();
async function filters(page,values){await page.locator('#filters').evaluate(e=>e.open=true);for(const [id,value]of Object.entries(values))await page.locator('#'+id).selectOption(value);}
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:'dark'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error'&&/Content Security Policy|Refused/.test(msg.text()))errors.push(msg.text());});
 await page.goto(base+'/?language=de');await page.waitForFunction(()=>window.XTendPage?.getRuntime());const origin=await page.evaluate(()=>performance.timeOrigin);
 await filters(page,{language:'en','time-range':'','safe-search':'0'});
 await page.getByRole('link',{name:'Bilder',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='images');
 assert.equal(new URL(page.url()).searchParams.get('language'),'en');assert.equal(await page.locator('#language').inputValue(),'en');
 await filters(page,{language:'all'});await page.getByRole('link',{name:'Web',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general');
 assert.equal(await page.locator('#language').inputValue(),'all');assert.equal(new URL(page.url()).searchParams.get('language'),'all');
 await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='images');assert.equal(await page.locator('#language').inputValue(),'en');
 await page.goForward();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general');assert.equal(await page.locator('#language').inputValue(),'all');
 await page.locator('#search-input').fill('filter-stream');await page.getByRole('button',{name:'Suchen',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='partial');
 await filters(page,{language:'en'});await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 assert.equal(await page.locator('#language').inputValue(),'en');
 await page.getByRole('button',{name:'Filter anwenden',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].language==='en');
 assert.equal(await page.locator('#language').inputValue(),'en');assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
 await filters(page,{language:'all'});await page.getByRole('button',{name:'Filter anwenden',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].language==='all'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 checks.push('Filter drafts drive category URLs; all/en transitions, back/forward and draft edits during real XScaler batches stay consistent without document reload.');
 // Header geometry, logo and real locally registered XIcon controls.
 assert.equal(await page.locator('header #search-form').count(),1);assert.equal(await page.locator('#search-form').count(),1);
 await page.waitForFunction(()=>customElements.get('x-icon'));
 assert.ok(await page.getByRole('link',{name:'Über XTend.search',exact:true}).locator('x-icon').evaluate(e=>!!e.shadowRoot?.querySelector('svg')));
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 assert.ok(await page.locator('a[data-report]').count());
 assert.equal(await page.locator('a[data-report]').first().getAttribute('aria-label'),'Ergebnis melden');
 assert.ok(await page.locator('a[data-report] x-icon').first().evaluate(e=>!!e.shadowRoot?.querySelector('svg')));
 await page.locator('a[data-report]').first().focus();await page.keyboard.press('Enter');await page.locator('#feedback-form select').waitFor();await page.keyboard.press('Escape');
 await page.locator('#filters').evaluate(e=>e.open=false);await page.locator('#search-input').focus();
 for(const scheme of ['dark','light']){
  await page.emulateMedia({colorScheme:scheme});
  for(const width of [320,390,768,1280,1920,3840]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'search overflow '+scheme+' '+width);
   const form=await page.locator('header #search-form').boundingBox();assert.ok(form&&form.x>=0&&form.x+form.width<=width+1);
   const input=await page.locator('#search-input').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.ok(input>=16);
   if(width===1920||width===390)await page.screenshot({path:new URL(version+'-search-'+scheme+'-'+width+'.png',out).pathname,fullPage:true});
  }
 }
 checks.push('One header form, accessible XIcon links, keyboard reporting and responsive light/dark layouts at 320–3840px; search input remains at least 16px.');
 await page.setViewportSize({width:1600,height:1000});await page.goto(base+'/admin');
 await page.waitForFunction(()=>customElements.get('x-button')&&!document.querySelector('#ccs-login').hidden);
 assert.ok(await page.locator('#ccs-login').evaluate(e=>!!e.shadowRoot?.querySelector('button')));
 await page.screenshot({path:new URL(version+'-ccs-login.png',out).pathname});
 for(const scheme of ['dark','light'])for(const width of [320,390,768,1920,3840]){
  await page.emulateMedia({colorScheme:scheme});await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'login overflow '+scheme+' '+width);
 }
 await page.setViewportSize({width:1600,height:1000});
 await page.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).click();await page.getByRole('link',{name:'administrator',exact:true}).click();await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 for(const scheme of ['dark','light']){
  await page.emulateMedia({colorScheme:scheme});
  const color=await page.locator('.observatory').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.equal(color,scheme==='dark'?'rgb(9, 9, 9)':'rgb(245, 242, 236)');
  assert.equal(await page.locator('.metric').first().evaluate(e=>getComputedStyle(e).borderRadius),'3px');
  await page.screenshot({path:new URL(version+'-observatory-'+scheme+'.png',out).pathname});
  for(const width of [320,390,768,1280,1920,3840]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Observatory overflow '+scheme+' '+width);
  }
  await page.setViewportSize({width:1600,height:1000});
 }
 const native=await browser.newContext({javaScriptEnabled:false}),np=await native.newPage();await np.goto(base+'/admin');
 await np.getByRole('link',{name:'Anmelden mit CCS Account',exact:true}).click();await np.getByRole('link',{name:'viewer',exact:true}).click();await np.getByRole('heading',{name:'Deine Quellen. Unter Kontrolle.'}).waitFor();await native.close();
 checks.push('Real XButton login and native no-JS fallback use the same mock Nextcloud OAuth flow; Observatory shares corporate tokens and restrained corners.');
 assert.deepEqual(errors,[]);
 await fs.writeFile(new URL(version+'-browser.json',out),JSON.stringify({ok:true,checks,errors},null,2));console.log(JSON.stringify({ok:true,checks}));
 await context.close();
}finally{await browser.close();}
