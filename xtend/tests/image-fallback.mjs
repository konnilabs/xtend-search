import {chromium,firefox} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8090',out='evidence/tests/image-fallback',results=[];fs.mkdirSync(out,{recursive:true});
for(let attempt=0;;attempt++){
 const healthy=await fetch(base+'/health/ready').then(r=>r.ok).catch(()=>false);
 if(healthy)break;
 if(attempt>=30)throw new Error('Fixture container is not ready.');
 await new Promise(resolve=>setTimeout(resolve,500));
}
const placeholder='/assets/xtend/image-placeholder.svg';
async function check(name,fn){if(process.env.TEST_CASE && !name.includes(process.env.TEST_CASE))return;try{await fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.stack});}console.log(JSON.stringify(results.at(-1)));}
async function setup(browser,options={}){
 const page=await browser.newPage({viewport:{width:1440,height:960},colorScheme:'dark',...options});page.setDefaultTimeout(10000);
 const errors=[],requests=[],failed=new Map([['thumb-0.png',403],['original-0.png',403],['thumb-1.png',200],['original-1.png',404]]),delayed=new Set();
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/image_proxy?**',async r=>{
  const filename=new URL(new URL(r.request().url()).searchParams.get('url')).pathname.split('/').at(-1);
  if(delayed.has(filename))await new Promise(resolve=>setTimeout(resolve,500));
  if(failed.has(filename))return r.fulfill({headers:{'Cache-Control':'no-store'},status:failed.get(filename),contentType:'image/png',body:'Not an image'}).catch(()=>{});
  return r.fulfill({headers:{'Cache-Control':'no-store'},contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#238da0"/><circle cx="570" cy="140" r="70" fill="#f9d482"/></svg>'}).catch(()=>{});
 });return {page,failed,delayed,errors,requests};
}
async function ready(page){await page.goto(base+'/search?q=media&categories=images');await page.waitForFunction(()=>window.XTendPage);}
async function selected(page,n){await page.locator('a[data-preview-id]').nth(n).click();await page.waitForFunction(n=>document.querySelector('.preview-position')?.textContent===`Bild ${n+1} von 6`,n);}
async function good(page,n){await page.waitForFunction(n=>document.querySelector('.preview-position')?.textContent===`Bild ${n+1} von 6` && document.getElementById('preview-image')?.naturalWidth>0,n);assert.equal(await page.locator('.preview-placeholder').count(),0);}
async function unavailable(page){await page.locator('.preview-placeholder img').waitFor();assert.equal(await page.locator('#preview-expand').count(),0);assert.equal(await page.getByRole('link',{name:'Originalbild öffnen ↗',exact:true}).isVisible(),true);}
for(const [name,launcher] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await launcher.launch();
 await check(`${name}: early SSR image failures, 403 and invalid image body become local placeholders`,async()=>{
  const {page,requests,errors}=await setup(browser);await page.route('**/chunks/page-client-*.mjs',async r=>{await new Promise(resolve=>setTimeout(resolve,200));await r.continue();});await ready(page);
  await page.waitForFunction(()=>document.querySelectorAll('.result-image[data-unavailable]').length===2);
  const tiles=page.locator('.result-image');for(const n of [0,1]){assert.equal(await tiles.nth(n).locator('img').getAttribute('src'),placeholder);assert.equal(await tiles.nth(n).locator('img').getAttribute('alt'),'Bild nicht verfügbar');assert.equal(await tiles.nth(n).getAttribute('href'),`https://images.example.test/original-${n}.png`);assert.equal(await tiles.nth(n).locator('.image-dimensions').isVisible(),false);}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const requestsBefore=requests.filter(u=>decodeURIComponent(u).includes('thumb-0.png')).length;await page.locator('#search-input').fill('unsent');await selected(page,2);await good(page,2);await page.keyboard.press('Escape');assert.equal(requests.filter(u=>decodeURIComponent(u).includes('thumb-0.png')).length,requestsBefore);
  await page.screenshot({path:`${out}/${name}-grid-dark.png`});assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(u=>!u.startsWith(base)),[]);await page.close();
 });
 await check(`${name}: unavailable sidebar recovers by arrows, another tile and close/reopen`,async()=>{
  const {page,errors}=await setup(browser);await ready(page);await page.evaluate(()=>window.__imageDocument=document);await selected(page,0);await unavailable(page);await page.getByRole('button',{name:'Nächstes Bild',exact:true}).click();await unavailable(page);await page.waitForFunction(()=>document.querySelector('.preview-position').textContent==='Bild 2 von 6');await page.getByRole('button',{name:'Nächstes Bild',exact:true}).click();await good(page,2);
  await selected(page,0);await unavailable(page);await selected(page,3);await good(page,3);await selected(page,1);await unavailable(page);await page.keyboard.press('Escape');await selected(page,4);await good(page,4);assert.equal(await page.evaluate(()=>document===window.__imageDocument),true);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${name}: late and repeated errors cannot poison the next selection`,async()=>{
  const {page,delayed,errors}=await setup(browser);delayed.add('original-0.png');await ready(page);await selected(page,0);await page.evaluate(()=>window.__oldImage=document.getElementById('preview-image'));await selected(page,2);await good(page,2);
  // A queued browser event retains its old target, even after the user switches.
  await page.evaluate(()=>{window.__oldImage?.dispatchEvent(new Event('error'));window.__oldImage?.dispatchEvent(new Event('error'));});await page.waitForTimeout(650);await good(page,2);assert.equal(await page.locator('#preview-image').getAttribute('src').then(x=>decodeURIComponent(x).includes('original-2.png')),true);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${name}: original-to-thumbnail fallback remains valid`,async()=>{
  const {page,failed}=await setup(browser);failed.set('original-3.png',502);await ready(page);await selected(page,3);await good(page,3);assert.match(decodeURIComponent(await page.locator('#preview-image').getAttribute('src')),/thumb-3.png/);assert.match(await page.locator('.preview-message').innerText(),/kleine Vorschau/);await selected(page,4);await good(page,4);await page.close();
 });
 await check(`${name}: full-screen skips unavailable images and resets the error state`,async()=>{
  const {page,errors}=await setup(browser);await ready(page);await selected(page,2);await good(page,2);await page.locator('#preview-expand').click();await page.locator('x-lightbox[open]').waitFor();await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('x-lightbox').hasAttribute('data-image-error'));
  assert.equal(await page.locator('x-lightbox').getAttribute('src'),placeholder);assert.match(await page.locator('.lightbox-message').innerText(),/weiterblättern/);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.lightbox-position').textContent==='Bild 2 von 6' && document.querySelector('x-lightbox').hasAttribute('data-image-error'));await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.lightbox-position').textContent==='Bild 3 von 6' && !document.querySelector('x-lightbox').hasAttribute('data-loading'));assert.equal(await page.locator('x-lightbox').getAttribute('data-image-error'),null);await page.keyboard.press('Escape');await good(page,2);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${name}: fresh search retries the source, including the same query`,async()=>{
  // Repeat the early submit: Firefox lazy images can briefly report complete
  // with zero width before issuing the retry, which is not a resource failure.
  for(let attempt=0;attempt<4;attempt++){
   const {page,failed,requests,errors}=await setup(browser);await ready(page);await page.locator('.result-image[data-unavailable]').first().waitFor();
   const before=requests.filter(u=>decodeURIComponent(u).includes('thumb-0.png')).length;
   failed.clear();await page.locator('#search-input').press('Enter');
   try{await page.waitForFunction(()=>!document.querySelector('.result-image[data-unavailable]') && document.querySelector('.result-image img')?.naturalWidth>0);}catch(error){
    fs.writeFileSync(`${out}/${name}-retry-failure.json`,JSON.stringify({attempt,requests,errors,state:await page.evaluate(()=>({data:window.XTendPage?.page?.props?.['search.data'],images:[...document.querySelectorAll('.result-image')].map(a=>({html:a.outerHTML,width:a.querySelector('img')?.naturalWidth,complete:a.querySelector('img')?.complete,currentSrc:a.querySelector('img')?.currentSrc}))}))},null,2));
    await page.close();throw error;
   }
   assert.notEqual(await page.locator('.result-image img').first().getAttribute('src'),placeholder);assert(requests.filter(u=>decodeURIComponent(u).includes('thumb-0.png')).length>before);
   await selected(page,0);await good(page,0);assert.deepEqual(errors,[]);await page.close();
  }
 });
 await check(`${name}: mobile dark/light placeholder and navigation to a new result set`,async()=>{
  const {page}=await setup(browser,{viewport:{width:390,height:844}});await ready(page);await selected(page,0);await unavailable(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${out}/${name}-sidebar-mobile-dark.png`});await page.emulateMedia({colorScheme:'light'});await page.screenshot({path:`${out}/${name}-sidebar-mobile-light.png`});await page.locator('#search-input').fill('media newer');await page.locator('#search-input').press('Enter');await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].q==='media newer');await selected(page,2);await good(page,2);await page.close();
 });
 await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify({timestamp:new Date().toISOString(),base,note:'Explicit offline Python fixture, synthetic images; simulated 403/404/502, invalid 200 image body, delayed and repeated error events. Production container assets without overrides.',results},null,2));if(results.some(x=>x.status!=='passed'))process.exitCode=1;
