import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',out=new URL('../../evidence/control-plane/',import.meta.url),checks=[];
const browser=await chromium.launch();let page;
async function icons(p){
 const links=await p.locator('head link[rel=icon]').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),type:e.type})));
 assert.deepEqual(links,[{href:'/assets/xtend/favicon.png',type:'image/png'},{href:'/assets/xtend/mark.svg',type:'image/svg+xml'}]);
 for(const link of links){const r=await p.request.get(base+link.href);assert.equal(r.status(),200);assert.ok(r.headers()['content-type'].startsWith(link.type));assert.ok((await r.body()).length>100);}
}
async function inside(p){return p.evaluate(()=>{const box=document.getElementById('search-about');let active=document.activeElement;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;return box.contains(active)||active?.getRootNode()?.host===box;});}
async function close(p,how='escape'){
 const modal=p.getByRole('dialog',{name:'Über XTend.search',exact:true});
 if(how==='button')await modal.getByRole('button',{name:'Schliessen',exact:true}).click();else await p.keyboard.press('Escape');
 await modal.waitFor({state:'hidden'});await p.waitForFunction(()=>!document.getElementById('xtend-page-container')?.inert&&document.documentElement.style.overflow!=='hidden');
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());await icons(page);
 assert.equal(await page.getByRole('link',{name:'Einstellungen',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>customElements.get('x-dialog')!==undefined),false,'Dialog loads on demand');
 const origin=await page.evaluate(()=>performance.timeOrigin),url=page.url();await page.locator('#search-input').fill('ungesendeter Suchbegriff');
 const top=page.getByRole('link',{name:'Über XTend.search',exact:true});await top.click();const dialog=page.getByRole('dialog',{name:'Über XTend.search',exact:true});await dialog.waitFor();
 assert.equal(await page.evaluate(()=>document.getElementById('search-about').constructor.xtendComponentContract.tag),'x-dialog');assert.equal(page.url(),url);assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);assert.equal(await page.locator('#search-input').inputValue(),'ungesendeter Suchbegriff');
 assert.match(await page.locator('#search-about').textContent(),/Powered by SearXNG/);assert.equal(await page.locator('#search-about').getByRole('link',{name:/Quellcode & Lizenzen/}).getAttribute('href'),'/source.tar.gz');assert.equal(await page.locator('#search-about').getByRole('link',{name:/Powered by SearXNG/}).getAttribute('rel'),'noopener noreferrer');
 for(let n=0;n<8;n++){await page.keyboard.press('Tab');assert.equal(await inside(page),true);}for(let n=0;n<8;n++){await page.keyboard.press('Shift+Tab');assert.equal(await inside(page),true);}
 const y=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,500);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>scrollY),y);await page.keyboard.press('/');assert.equal(await inside(page),true);
 await page.screenshot({path:new URL('release-0.3.3-about-desktop.png',out).pathname});await close(page);assert.equal(await top.evaluate(e=>document.activeElement===e),true);
 const footer=page.getByRole('link',{name:'Über & Datenschutz',exact:true});await footer.scrollIntoViewIfNeeded();const footerY=await page.evaluate(()=>scrollY);await footer.click();await dialog.waitFor();await page.mouse.click(5,5);await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent==='Über & Datenschutz');assert.equal(await page.evaluate(()=>scrollY),footerY);
 checks.push('Existing SVG and PNG favicons load. Settings is removed. A genuine lazy XDialog opens from both About links without changing the document, URL or query draft. Tab/Shift+Tab stay inside; Escape and backdrop return focus and scroll.');
 for(const [width,scheme]of [[320,'light'],[390,'dark'],[720,'light']]){
  await page.setViewportSize({width,height:844});await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});await top.click();await dialog.waitFor();
  const rect=await dialog.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width+1);assert.ok(rect.y>=0&&rect.y+rect.height<=844+1);assert.equal(await dialog.evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await top.isVisible());
  // Long text scrolls inside the modal; the download remains reachable.
  const download=page.locator('#search-about').getByRole('link',{name:/Quellcode & Lizenzen/});await download.scrollIntoViewIfNeeded();assert.ok(await download.isVisible());
  const linkRect=await download.boundingBox();assert.ok(linkRect.y>=rect.y&&linkRect.y+linkRect.height<=rect.y+rect.height,'Download stays inside the dialog surface');
  assert.ok(await page.locator('#search-about').evaluate(e=>{const surface=e.shadowRoot.querySelector('[part~=surface]').getBoundingClientRect(),content=e.shadowRoot.querySelector('[part=content]').getBoundingClientRect();return content.bottom<=surface.bottom&&content.top>=surface.top;}),'Scroll area stays within the surface');
  await page.screenshot({path:new URL(`release-0.3.3-about-${width}-${scheme}.png`,out).pathname});await close(page,'button');
 }
 checks.push('320/390/720px layouts, light/dark colors, internal scrolling and reduced motion work; the About link stays visible on mobile.');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/info/de/about');await icons(page);assert.equal(await page.locator('h1').textContent(),'Über XTend.search');assert.equal(await page.locator('.about-sections section').count(),4);await page.screenshot({path:new URL('release-0.3.3-about-page.png',out).pathname,fullPage:true});
 const nj=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),np=await nj.newPage();await np.goto(base+'/');await np.getByRole('link',{name:'Über XTend.search',exact:true}).click();await np.waitForURL(base+'/info/de/about');assert.ok(await np.getByRole('link',{name:/Powered by SearXNG/}).isVisible());assert.ok(await np.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await np.goto(base+'/info/en/about');assert.equal(await np.locator('h1').textContent(),'About XTend.search');await icons(np);await nj.close();
 const failed=await browser.newContext(),fp=await failed.newPage();await fp.goto(base+'/');await fp.waitForFunction(()=>window.XTendPage?.getRuntime());await fp.route('**/chunks/*',r=>r.abort());await fp.getByRole('link',{name:'Über XTend.search',exact:true}).click();await fp.waitForURL(base+'/info/de/about');await failed.close();
 checks.push('Direct German/English About pages retain favicon and readable sections. No-JS links and a failed lazy import fall back to the standalone page.');
 // Exercise the dialog while XScaler continues committing search results.
 await page.goto(base+'/admin');await icons(page);await page.getByRole('link',{name:'Mit Nextcloud anmelden'}).click();await page.getByRole('link',{name:'administrator',exact:true}).click();await page.waitForFunction(()=>window.XTendPage?.getRuntime());await icons(page);
 for(const id of ['fixture fast','fixture medium','fixture slow']){
  await page.evaluate(id=>window.XTendPage.visit('/admin?view=sources&engine='+encodeURIComponent(id)),id);await page.waitForFunction(id=>document.querySelector('.engine-detail h3')?.textContent===id,id);await page.locator('#policy-form select[name=state]').selectOption('allowed');await page.locator('#policy-form input[name=capabilities]').fill('general');await page.locator('#policy-form input[name=family]').fill(id.replaceAll(' ','-'));await page.locator('#policy-form input[name=rpm]').fill('60');await page.locator('#policy-form input[name=concurrency]').fill('4');const rev=await page.locator('#policy-form input[name=revision]').inputValue();await page.getByRole('button',{name:'Policy verbindlich speichern',exact:true}).click();await page.waitForFunction(rev=>document.querySelector('#policy-form input[name=revision]').value!==rev,rev);
 }
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());const searchOrigin=await page.evaluate(()=>performance.timeOrigin);await page.locator('#search-input').fill('open source');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='partial');await top.click();await dialog.waitFor();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');assert.ok(await dialog.isVisible());await close(page);assert.ok(await page.locator('article.result').count());assert.equal(await page.evaluate(()=>performance.timeOrigin),searchOrigin);await icons(page);
 const resultTitles=await page.locator('article.result h2').allTextContents();await top.click();await dialog.waitFor();await close(page);assert.deepEqual(await page.locator('article.result h2').allTextContents(),resultTitles);
 checks.push('Login and authenticated Observatory retain both favicons. Search streaming continues behind the modal, then leaves all results available; dialog toggles preserve the resumed document and result set.');
 assert.deepEqual(errors,[]);const report={ok:true,checks};await fs.writeFile(new URL('release-0.3.3-about-browser.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.error(error);await page?.screenshot({path:new URL('release-0.3.3-about-failure.png',out).pathname,fullPage:true}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
