import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8090',out='evidence/tests/lightbox',results=[];fs.mkdirSync(out,{recursive:true});
async function check(name,fn){try{await fn();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.stack});}console.log(JSON.stringify(results.at(-1)));}
async function setup(browser,options={}){
 const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark',...options});page.setDefaultTimeout(8000);const requests=[],errors=[],failed=new Set();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 if(process.env.TEST_CSS_OVERRIDE)await page.route('**/assets/xtend/search.css',r=>r.fulfill({contentType:'text/css',body:fs.readFileSync(process.env.TEST_CSS_OVERRIDE,'utf8')}));
 await page.route('**/image_proxy?**',r=>{
  const url=new URL(r.request().url()).searchParams.get('url');if(failed.has(url))return r.fulfill({status:502,body:'Not available'});
  const n=Number(url.match(/-(\d+)/)?.[1] || 0),colors=['#169cb0','#8694d7','#d69076','#70ab89','#b49b62','#9d78ba'];
  return r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#e9f5f5"/><circle cx="1260" cy="230" r="120" fill="#ffce69"/><path d="M0 1000L540 280L1000 950L1300 510L1600 1000Z" fill="${colors[n%6]}"/><path d="M0 1000L500 650L930 1000L1500 650L1600 1000Z" fill="#183f50"/><text x="85" y="145" font-family="sans-serif" font-size="60" fill="#183f50">XTend · Testmotiv ${n+1}</text></svg>`});
 });return {page,requests,errors,failed};
}
async function ready(page){await page.goto(base+'/search?q=media&categories=images');await page.waitForFunction(()=>window.XTendPage);await page.locator('a[data-preview-id]').nth(5).waitFor();}
async function sidebar(page,index=0){await page.locator('a[data-preview-id]').nth(index).click();await page.locator('#preview-expand').waitFor();}
async function expand(page){await page.locator('#preview-expand').click();await page.locator('x-lightbox[open]').waitFor();await page.waitForFunction(()=>!document.getElementById('search-lightbox').hasAttribute('data-loading'));}
async function position(page,n){await page.waitForFunction(n=>document.querySelector('.lightbox-position').textContent===`Bild ${n} von 6`,n);}
async function dismiss(page){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('search-lightbox').hasAttribute('open'));}
for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await engine.launch();
 await check(`${name}: genuine lazy XLightbox, current selection, full-page carousel, sidebar sync`,async()=>{
  const {page,requests,errors}=await setup(browser);await ready(page);const url=page.url();await page.evaluate(()=>window.__lightboxDocument=document);
  assert.equal(await page.evaluate(()=>!!customElements.get('x-lightbox')),false);assert.equal(requests.some(x=>x.includes('/chunks/lightbox-')),false);
  await sidebar(page,3);await expand(page);assert.equal(await page.locator('x-lightbox').evaluate(e=>e.snapshot().componentRef),'x-lightbox');assert.equal(await page.locator('x-lightbox').evaluate(e=>e.constructor===window.XLightbox),true);await position(page,4);
  assert.match(await page.locator('x-lightbox').ariaSnapshot(),/dialog "Lightbox":[\s\S]*button "Nächstes Bild im Vollbild"/);
  await page.screenshot({animations:'disabled',path:`${out}/${name}-desktop.png`});
  await page.getByRole('button',{name:'Nächstes Bild im Vollbild'}).click();await position(page,5);await page.keyboard.press('ArrowRight');await position(page,6);await page.keyboard.press('ArrowRight');await position(page,1);await page.keyboard.press('ArrowLeft');await position(page,6);await page.keyboard.press('Home');await position(page,1);await page.keyboard.press('End');await position(page,6);
  await page.waitForFunction(()=>document.querySelector('.preview-position').textContent==='Bild 6 von 6');assert.equal(page.url(),url);assert.equal(await page.evaluate(()=>window.__lightboxDocument===document),true);
  await dismiss(page);assert.equal(await page.locator('#image-preview').isVisible(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-expand');assert.match(await page.locator('#image-preview h2').innerText(),/Landschaft 6/);
  assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(x=>!x.startsWith(base)),[]);await page.close();
 });
 await check(`${name}: modal focus, scroll lock, close button, reopen and Escape layers`,async()=>{
  const {page}=await setup(browser);await ready(page);await sidebar(page,1);await page.evaluate(()=>document.documentElement.style.overflow='auto');await expand(page);
  assert.equal(await page.locator('#xtend-page-container').evaluate(e=>e.inert),true);assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
  for(const key of ['Tab','Tab','Tab','Tab','Tab','Tab','Shift+Tab','Shift+Tab']){await page.keyboard.press(key);assert.equal(await page.evaluate(()=>document.activeElement===document.getElementById('search-lightbox') || document.getElementById('search-lightbox').contains(document.activeElement)),true);}
  await page.locator('x-lightbox').getByRole('button',{name:'Schliessen',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('search-lightbox').hasAttribute('open'));assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'auto');assert.equal(await page.locator('#xtend-page-container').evaluate(e=>e.inert),false);
  await expand(page);await dismiss(page);assert.equal(await page.locator('#image-preview').count(),1);await page.keyboard.press('Escape');await page.locator('#image-preview').waitFor({state:'detached'});await page.close();
 });
 await check(`${name}: failed originals, thumbnail fallback, failed media can be skipped`,async()=>{
  const {page,failed}=await setup(browser);failed.add('https://images.example.test/original-0.png');failed.add('https://images.example.test/original-1.png');failed.add('https://images.example.test/thumb-1.png');await ready(page);await sidebar(page,0);await expand(page);
  assert.match(await page.locator('.lightbox-message').innerText(),/Vorschaubild/);assert.match(await page.locator('x-lightbox').getAttribute('src'),/thumb-0/);
  failed.add('https://images.example.test/original-1.png');failed.add('https://images.example.test/thumb-1.png');await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.getElementById('search-lightbox').hasAttribute('data-image-error'));assert.match(await page.locator('.lightbox-message').innerText(),/weiterblättern/);
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>!document.getElementById('search-lightbox').hasAttribute('data-loading'));assert.equal(await page.locator('x-lightbox').getAttribute('data-image-error'),null);await position(page,3);await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.getElementById('search-lightbox').hasAttribute('data-image-error'));await page.locator('#preview-expand').waitFor({state:'detached'});await dismiss(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-close');await page.close();
 });
 await check(`${name}: pending lazy import and active modal cannot survive navigation`,async()=>{
  const {page}=await setup(browser);await page.route('**/chunks/lightbox-*.mjs',async r=>{await new Promise(resolve=>setTimeout(resolve,500));await r.continue();});await ready(page);await sidebar(page,2);await page.locator('#preview-expand').click();
  await page.evaluate(()=>window.XTendPage.visit('/search?q=newer&categories=general'));await page.waitForTimeout(650);assert.equal(await page.locator('x-lightbox[open]').count(),0);assert.equal(await page.locator('#xtend-page-container').evaluate(e=>e.inert),false);
  await ready(page);await sidebar(page,1);await expand(page);await page.evaluate(()=>window.XTendPage.visit('/search?q=after&categories=general'));await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].q==='after');assert.equal(await page.locator('x-lightbox[open]').count(),0);assert.equal(await page.locator('#xtend-page-container').evaluate(e=>e.inert),false);assert.equal(await page.locator('#image-preview').count(),0);await page.close();
 });
 await check(`${name}: unavailable optional module preserves sidebar`,async()=>{
  const {page}=await setup(browser);await page.route('**/chunks/lightbox-*.mjs',r=>r.abort());await ready(page);await sidebar(page,2);await page.locator('#preview-expand').click();await page.getByText(/Vollbildansicht konnte nicht geladen/).waitFor();assert.equal(await page.locator('#image-preview').isVisible(),true);assert.equal(await page.locator('x-lightbox[open]').count(),0);assert.equal(await page.getByRole('link',{name:'Originalbild öffnen ↗',exact:true}).isVisible(),true);await page.close();
 });
 await check(`${name}: narrow viewport, swipe and no overflow`,async()=>{
  const {page,errors}=await setup(browser,{viewport:{width:390,height:844},hasTouch:true});await ready(page);await sidebar(page,2);await expand(page);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const dialog=await page.getByRole('dialog').boundingBox();assert.ok(dialog.x>=0 && dialog.y>=0 && dialog.width<=390 && dialog.height<=844);
  await page.screenshot({animations:'disabled',path:`${out}/${name}-mobile.png`});const media=page.locator('x-lightbox').locator('[part~="media"]');await media.dispatchEvent('pointerdown',{pointerType:'touch',clientX:280,clientY:300,bubbles:true,composed:true});await media.dispatchEvent('pointerup',{pointerType:'touch',clientX:80,clientY:305,bubbles:true,composed:true});await position(page,4);await dismiss(page);assert.deepEqual(errors,[]);await page.close();
 });
 await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify({timestamp:new Date().toISOString(),base,cssOverride:process.env.TEST_CSS_OVERRIDE || null,results},null,2));if(results.some(r=>r.status!=='passed'))process.exitCode=1;
