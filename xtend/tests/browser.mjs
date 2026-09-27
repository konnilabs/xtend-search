import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8080';
const results=[];fs.mkdirSync('evidence/tests',{recursive:true});
async function check(name,fn){const start=performance.now();try{await fn();results.push({name,status:'passed',ms:Math.round(performance.now()-start)});}catch(error){results.push({name,status:'failed',error:error.stack || error.message});}console.log(JSON.stringify(results.at(-1)));}
async function ready(page,path='/'){await page.goto(base+path);await page.waitForFunction(()=>window.XTendPage);}
async function search(page,q){await page.locator('#search-input').fill(q);await page.locator('#search-input').press('Enter');await page.waitForFunction(query=>{const d=window.XTendPage?.page?.props?.['search.data'];return d?.q===query && (!d.stream || d.stream.phase==='complete');},q);}
for(const [engine,launcher] of [['chromium',chromium],['firefox',firefox]]){
 let browser;try{browser=await launcher.launch({headless:true});}catch(error){results.push({name:engine,status:'blocked',error:error.stack || error.message});continue;}
 await check(`${engine}: signed resume, persistent shell, navigation, filters, history`,async()=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.addEventListener('xtend-page:capturing',()=>{window.__ssrInput=document.querySelector('#search-input');window.__shell=document.querySelector('#search-shell');});});
  await ready(page);assert.equal(await page.locator('[data-rmt-resume-status]').first().getAttribute('data-rmt-resume-status'),'resumed');
  assert.equal(await page.evaluate(()=>window.__ssrInput===document.querySelector('#search-input')),true);
  assert.equal(await page.locator('html').getAttribute('lang'),'de');
  await page.screenshot({path:`evidence/tests/${engine}-home.png`,fullPage:true});
  await search(page,'XTend');assert.equal(await page.locator('article').count(),6);
  assert.equal(await page.evaluate(()=>window.__shell===document.querySelector('#search-shell')),true);
  assert.equal(await page.evaluate(()=>window.__ssrInput===document.querySelector('#search-input')),true);
  await page.locator('#filters summary').click();await page.locator('#language').selectOption('de');await page.locator('#safe-search').selectOption('2');await page.getByRole('button',{name:'Filter anwenden'}).click();
  await page.waitForURL(/language=de.*safesearch=2/);assert.equal(await page.locator('#language').inputValue(),'de');
  await page.locator('#filters summary').click();
  await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.waitForURL(/categories=images/);assert.equal(await page.locator('.image-results').count(),1);
  await page.goBack();await page.waitForFunction(()=>window.XTendPage?.page?.props?.['search.data']?.category==='general');await page.waitForURL(/categories=general.*language=de/);assert.equal(await page.locator('.web-results').count(),1);
  await page.goForward();await page.waitForFunction(()=>window.XTendPage?.page?.props?.['search.data']?.category==='images');await page.waitForURL(/categories=images/);
  await page.getByRole('link',{name:'Nächste Seite'}).click();await page.waitForURL(/pageno=2/);
  assert.equal(await page.evaluate(()=>window.__shell===document.querySelector('#search-shell')),true);
  await page.screenshot({path:`evidence/tests/${engine}-results.png`,fullPage:true});
  assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${engine}: newer search wins, draft survives in-flight request`,async()=>{
  const page=await browser.newPage();await ready(page);
  await page.locator('#search-input').fill('slow first');await page.locator('#search-input').press('Enter');
  await page.waitForTimeout(80);await search(page,'latest');await page.waitForTimeout(800);assert.match(await page.locator('article h2').first().innerText(),/^latest/);
  await page.locator('#search-input').fill('slow second');await page.locator('#search-input').press('Enter');await page.waitForTimeout(80);await page.locator('#search-input').fill('unsent draft');
  await page.waitForFunction(()=>window.XTendPage?.page?.props?.['search.data']?.q==='slow second');await page.waitForTimeout(100);assert.equal(await page.locator('#search-input').inputValue(),'unsent draft');await page.close();
 });
 await check(`${engine}: empty state and engine error`,async()=>{
  const page=await browser.newPage();await ready(page);await search(page,'empty');assert.match(await page.locator('#results').innerText(),/Noch nichts gefunden/);
  await search(page,'error');assert.match(await page.locator('#results').innerText(),/nicht erreichbar/);await page.close();
 });
 await check(`${engine}: no JavaScript search, filters, paging and branding`,async()=>{
  const page=await browser.newPage({javaScriptEnabled:false});await page.goto(base);await page.locator('#search-input').fill('native');await page.locator('#search-input').press('Enter');await page.waitForURL(/q=native/);assert.equal(await page.locator('article').count(),6);
  await page.locator('#filters summary').click();await page.locator('#language').selectOption('de');await page.getByRole('button',{name:'Filter anwenden'}).click();await page.waitForURL(/language=de/);assert.equal(await page.locator('#language').inputValue(),'de');
  await page.getByRole('link',{name:'Nächste Seite'}).click();await page.waitForURL(/pageno=2/);assert.equal(await page.locator('article').count(),6);
  await page.goto(base+'/info/de/about');assert.match(await page.locator('body').innerText(),/Powered by SearXNG/);assert.equal(await page.locator('img[src*=searxng]').count(),0);
  await page.goto(base+'/classic/');assert.match(await page.locator('body').innerText(),/XTend/);await page.close();
 });
 await check(`${engine}: mobile layout`,async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});await ready(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`evidence/tests/${engine}-mobile.png`,fullPage:true});await search(page,'mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.close();
 });
 await check(`${engine}: rejected signature falls back once`,async()=>{
  const page=await browser.newPage();await page.route('**/assets/xtend/resume-key.mjs',async route=>{const response=await route.fetch();const body=(await response.text()).replace(/"kid":\s*"[^"]+"/,'"kid":"deliberately-wrong"');await route.fulfill({response,body});});
  await ready(page);assert.equal(await page.locator('[data-rmt-resume-status]').first().getAttribute('data-rmt-resume-status'),'fallback_hydrated');await search(page,'fallback');assert.equal(await page.locator('article').count(),6);await page.close();
 });
 await check(`${engine}: early input is replayed and untrusted text stays text`,async()=>{
  const page=await browser.newPage();await page.route('**/chunks/page-client-*.mjs',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue();});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('#search-input').fill('early draft');await page.waitForFunction(()=>window.XTendPage);assert.equal(await page.locator('#search-input').inputValue(),'early draft');
  await search(page,'<img src=x onerror=window.__xss=1>');assert.equal(await page.evaluate(()=>window.__xss),undefined);assert.equal(await page.locator('article img[src="x"]').count(),0);await page.close();
 });
 await check(`${engine}: missing JavaScript keeps native form working`,async()=>{
  const page=await browser.newPage();await page.route('**/assets/xtend/**/*.mjs',route=>route.abort());await page.goto(base);await page.locator('#search-input').fill('module blocked');await page.locator('#search-input').press('Enter');await page.waitForURL(/q=module/);assert.equal(await page.locator('article').count(),6);await page.close();
 });
 await browser.close();
}
await check('security: private routes and JSON are inaccessible',async()=>{
 for(const route of ['/config','/stats','/classic/config','/classic/stats','/search?q=x&format=json','/classic/search?q=x&format=json','/assets/xtend/%2e%2e%2f%2e%2e%2f.secrets/resume-private.pem']){
  const res=await fetch(base+route);assert.ok([403,404].includes(res.status),route+': '+res.status);
 }
 const res=await fetch(base+'/classic/search',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'q=x&format=json'});assert.equal(res.status,403);
});
fs.writeFileSync('evidence/tests/browser.json',JSON.stringify({timestamp:new Date().toISOString(),base,results},null,2));
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
