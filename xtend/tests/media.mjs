import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8090',results=[];
fs.mkdirSync('evidence/tests',{recursive:true});
async function check(name,fn){const start=performance.now();try{await fn();results.push({name,status:'passed',ms:Math.round(performance.now()-start)});}catch(error){results.push({name,status:'failed',error:error.stack});}console.log(JSON.stringify(results.at(-1)));}
async function ready(page,path){await page.goto(base+path);await page.waitForFunction(()=>window.XTendPage);}
async function setup(browser,options={}){
 const page=await browser.newPage({viewport:{width:1440,height:1000},...options});page.setDefaultTimeout(8000);
 const requests=[],errors=[],failed=new Set();page.on('pageerror',error=>errors.push(error.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/image_proxy?**',route=>{
  const source=new URL(route.request().url()).searchParams.get('url');
  if(failed.has(source))return route.fulfill({status:502,body:'Image unavailable'});
  const n=Number(source.match(/-(\d+)/)?.[1] || 0),colors=['#139caf','#6980cf','#d88469','#448e72','#b29340','#8a679e'];
  return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#e8f3f4"/><circle cx="1190" cy="230" r="125" fill="#ffcf6e"/><path d="M0 860L450 240L900 830L1220 380L1600 860V1000H0Z" fill="${colors[n]}"/><path d="M0 890L570 560L1050 890L1600 640V1000H0Z" fill="#173d50"/><text x="80" y="140" font-family="sans-serif" font-size="54" fill="#173d50">XTend · Testmotiv ${n+1}</text></svg>`});
 });
 return {page,requests,errors,failed};
}
async function opened(page,index=0){await page.locator('a[data-preview-id]').nth(index).click();await page.locator('#image-preview').waitFor();await page.waitForFunction(()=>document.getElementById('preview-image')?.naturalWidth>0);}
const selected=page=>page.locator('article[data-selected]');
for(const [engine,launcher] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await launcher.launch({headless:true});
 await check(`${engine}: knowledge, sources, facts, history, dark mode`,async()=>{
  const {page,requests,errors}=await setup(browser);await ready(page,'/search?q=media');await page.evaluate(()=>window.__mediaShell=document.querySelector('#search-shell'));
  const card=page.locator('.knowledge-card');assert.equal(await card.count(),1);assert.equal(await card.locator('h2').innerText(),'Offenes Web');assert.match(await card.innerText(),/HTML, CSS, JavaScript/);assert.match(await card.innerText(),/Das offene Web verbindet Wissen, Menschen & Ideen/);assert.equal(await card.locator('b,script').count(),0);
  assert.equal(await card.getByRole('link',{name:'Wikipedia',exact:true}).getAttribute('href'),'https://de.wikipedia.org/wiki/World_Wide_Web');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`evidence/tests/${engine}-knowledge-light.png`,fullPage:true});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:`evidence/tests/${engine}-knowledge-dark.png`,fullPage:true});
  await card.getByRole('link',{name:'Webstandards',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].q==='Webstandards');assert.equal(await card.count(),0);await page.goBack();await card.waitFor();assert.equal(await page.evaluate(()=>window.__mediaShell===document.querySelector('#search-shell')),true);
  await ready(page,'/search?q=media%20only');assert.equal(await card.count(),1);assert.doesNotMatch(await page.locator('#results').innerText(),/Noch nichts gefunden|nicht verfügbar/);assert.deepEqual(requests.filter(url=>!url.startsWith(base)),[]);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${engine}: lazy panel, metadata, keyboard, boundaries, focus`,async()=>{
  const {page,requests,errors}=await setup(browser);await ready(page,'/search?q=media&categories=images');assert.equal(await page.locator('article').count(),6);assert.equal(requests.some(url=>decodeURIComponent(url).includes('original-')),false);
  const url=page.url();await page.evaluate(()=>window.__mediaDocument=document);await opened(page);assert.equal(page.url(),url);assert.equal(await page.evaluate(()=>window.__mediaDocument===document),true);assert.equal(await selected(page).count(),1);assert.equal(await page.locator('#preview-close').evaluate(el=>el===document.activeElement),true);assert.equal(await page.getByRole('button',{name:'Vorheriges Bild',exact:true}).isDisabled(),true);
  assert.match(await page.locator('#image-preview').innerText(),/1600 × 1000/);assert.match(await page.locator('#image-preview').innerText(),/XTend Testsammlung/);assert.equal(await page.getByRole('link',{name:'Originalbild öffnen ↗',exact:true}).getAttribute('href'),'https://images.example.test/original-0.png');
  const grid=await page.locator('.result-main').boundingBox(),panel=await page.locator('#image-preview').boundingBox();assert.ok(panel.x>=grid.x+grid.width);
  await page.screenshot({path:`evidence/tests/${engine}-preview-light.png`,fullPage:true});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:`evidence/tests/${engine}-preview-dark.png`,fullPage:true});
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.preview-position')?.textContent==='Bild 2 von 6');await page.getByRole('button',{name:'Nächstes Bild',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.preview-position')?.textContent==='Bild 3 von 6');await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('.preview-position')?.textContent==='Bild 2 von 6');
  const id=await selected(page).locator('a[data-preview-id]').getAttribute('data-preview-id');await page.keyboard.press('Escape');await page.locator('#image-preview').waitFor({state:'detached'});assert.equal(await page.locator('#image-preview').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.dataset.previewId),id);
  await opened(page,5);assert.equal(await page.getByRole('button',{name:'Nächstes Bild',exact:true}).isDisabled(),true);await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.preview-position').innerText(),'Bild 6 von 6');await page.getByRole('button',{name:'Bildvorschau schließen',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('article[data-selected]'));assert.equal(await selected(page).count(),0);assert.deepEqual(requests.filter(url=>!url.startsWith(base)),[]);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${engine}: navigation clears preview`,async()=>{
  const {page,errors}=await setup(browser);await ready(page,'/search?q=media&categories=images');await opened(page);await page.getByRole('link',{name:'Web',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general');await page.locator('#image-preview').waitFor({state:'detached'});assert.equal(await page.locator('#image-preview').count(),0);await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='images');await page.locator('#image-preview').waitFor({state:'detached'});assert.equal(await page.locator('#image-preview').count(),0);
  await opened(page,1);await page.locator('#search-input').fill('slow media');await page.locator('#search-input').press('Enter');await page.locator('#image-preview').waitFor({state:'detached'});await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].q==='slow media');await page.locator('#image-preview').waitFor({state:'detached'});assert.equal(await page.locator('#image-preview').count(),0);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${engine}: image error fallback`,async()=>{
  const {page,failed}=await setup(browser);failed.add('https://images.example.test/original-0.png');await ready(page,'/search?q=media&categories=images');await opened(page);assert.match(await page.locator('.preview-message').innerText(),/kleine Vorschau/);assert.match(decodeURIComponent(await page.locator('#preview-image').getAttribute('src')),/thumb-0.png/);
  await page.keyboard.press('Escape');failed.add('https://images.example.test/original-1.png');failed.add('https://images.example.test/thumb-1.png');await ready(page,'/search?q=media%20broken&categories=images');await page.locator('a[data-preview-id]').nth(1).click();await page.waitForFunction(()=>document.querySelector('.preview-message')?.textContent.includes('Du kannst die Quellseite'));assert.equal(await page.locator('#preview-image').count(),0);assert.equal(await page.getByRole('link',{name:'Originalbild öffnen ↗',exact:true}).isVisible(),true);await page.close();
 });
 for(const width of [390,900])await check(`${engine}: responsive ${width}px`,async()=>{
  const {page,errors}=await setup(browser,{viewport:{width,height:844},colorScheme:'dark'});await ready(page,'/search?q=media');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`evidence/tests/${engine}-knowledge-${width}.png`,fullPage:true});
  await ready(page,'/search?q=media&categories=images');await opened(page,2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const grid=await page.locator('.result-main').boundingBox(),panel=await page.locator('#image-preview').boundingBox();assert.ok(panel.y<grid.y);await page.screenshot({path:`evidence/tests/${engine}-preview-${width}.png`,fullPage:true});await page.getByRole('button',{name:'Bildvorschau schließen',exact:true}).click();await page.locator('#image-preview').waitFor({state:'detached'});assert.equal(await page.locator('#image-preview').count(),0);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${engine}: no-JS cards and native image links`,async()=>{
  const {page,requests}=await setup(browser,{javaScriptEnabled:false});await page.goto(base+'/search?q=media');assert.equal(await page.locator('.knowledge-card').count(),1);assert.match(await page.locator('.knowledge-card').innerText(),/Offene Standards/);await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.waitForURL(/categories=images/);assert.equal(await page.locator('article').count(),6);assert.equal(await page.locator('a[data-preview-id]').first().getAttribute('href'),'https://images.example.test/original-0.png');await page.locator('#image-preview').waitFor({state:'detached'});assert.equal(await page.locator('#image-preview').count(),0);assert.equal(requests.some(url=>decodeURIComponent(url).includes('original-')),false);assert.deepEqual(requests.filter(url=>!url.startsWith(base)),[]);await page.close();
 });
 await browser.close();
}
fs.writeFileSync('evidence/tests/media.json',JSON.stringify({timestamp:new Date().toISOString(),base,note:'Offline SearXNG fixture; image-proxy responses replaced with deterministic SVGs. Real Python contract, Maraca SSR and signed resume.',results},null,2));if(results.some(r=>r.status!=='passed'))process.exitCode=1;
