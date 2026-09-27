import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8090',out='evidence/tests/alerts',results=[];
fs.mkdirSync(out,{recursive:true});
async function check(name,fn){try{await fn();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.stack});}console.log(JSON.stringify(results.at(-1)));}
async function setup(browser,options={}){
 const page=await browser.newPage({viewport:{width:1440,height:950},colorScheme:'dark',...options});page.setDefaultTimeout(10000);
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/image_proxy?**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#348da3"/><circle cx="550" cy="150" r="70" fill="#f9d894"/></svg>'}));
 return {page,errors,requests};
}
const alerts=page=>page.locator('x-alert.search-warning');
const close=page=>alerts(page).getByRole('button',{name:'Schliessen',exact:true});
async function ready(page,q='media alerts',category='images'){
 await page.goto(base+'/search?'+new URLSearchParams({q,categories:category}));await page.waitForFunction(()=>window.XTendPage);await close(page).waitFor();
}
async function gone(page){await alerts(page).waitFor({state:'detached'});}
for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await engine.launch();
 await check(`${name}: real Classic XAlert, no autofocus, no timer, keyboard dismissal and focus`,async()=>{
  const {page,errors,requests}=await setup(browser);let release;const hold=new Promise(r=>release=r);
  await page.route('**/maraca/chunks/x-alert-*.mjs',async r=>{await hold;await r.continue();});
  await page.goto(base+'/search?q=media%20alerts&categories=images');await page.locator('#search-input').focus();release();await page.waitForFunction(()=>window.XTendPage);await close(page).waitFor();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'search-input');
  assert.equal(await alerts(page).evaluate(e=>e.constructor.xtendComponentContract.tag),'x-alert');
  assert.equal(await alerts(page).getAttribute('type'),'info');assert.equal(await alerts(page).getAttribute('duration'),'0');assert.equal(await alerts(page).getAttribute('overlay'),null);
  await close(page).focus();await page.keyboard.press('Enter');await gone(page);await page.waitForFunction(()=>document.activeElement.id==='results-heading');
  await page.locator('#search-input').fill('edited draft');assert.equal(await alerts(page).count(),0);assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(x=>!x.startsWith(base)),[]);await page.close();
 });
 await check(`${name}: dismissed hint stays hidden through preview, full-screen carousel and filter edits`,async()=>{
  const {page,errors}=await setup(browser);await ready(page);await page.evaluate(()=>window.__alertsDocument=document);await close(page).click();await gone(page);
  await page.locator('a[data-preview-id]').first().click();await page.locator('#preview-expand').click();await page.locator('x-lightbox[open]').waitFor();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('x-lightbox[open]'));assert.equal(await alerts(page).count(),0);await page.keyboard.press('Escape');await page.locator('#filters summary').click();await page.locator('#language').selectOption('de');assert.equal(await alerts(page).count(),0);assert.equal(await page.evaluate(()=>document===window.__alertsDocument),true);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${name}: new response, same-query submit and history restore notices`,async()=>{
  const {page,errors}=await setup(browser);await ready(page);await page.evaluate(()=>window.__alertsDocument=document);await close(page).click();await gone(page);
  await page.locator('#search-input').press('Enter');await close(page).waitFor();await close(page).click();await gone(page);
  await page.locator('#search-input').fill('media');await page.locator('#search-input').press('Enter');await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].q==='media');assert.equal(await alerts(page).count(),0);
  await page.goBack();await close(page).waitFor();assert.equal(await page.evaluate(()=>document===window.__alertsDocument),true);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${name}: engine warning can close while failure guidance remains`,async()=>{
  const {page,errors}=await setup(browser);await ready(page,'error','general');assert.equal(await alerts(page).getAttribute('type'),'warning');assert.match(await alerts(page).innerText(),/Suchquelle antwortet/);await close(page).click();await gone(page);assert.equal(await page.getByRole('heading',{name:'Die Suche ist gerade nicht erreichbar.'}).isVisible(),true);assert.deepEqual(errors,[]);await page.close();
 });
 await check(`${name}: dark/light and narrow layout`,async()=>{
  const {page}=await setup(browser,{viewport:{width:390,height:844}});await ready(page);const dark=await alerts(page).locator('[part~=root]').evaluate(e=>getComputedStyle(e).backgroundColor);assert.equal(dark,'rgb(23, 46, 59)');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${out}/${name}-dark-mobile.png`});await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>getComputedStyle(document.querySelector('x-alert').shadowRoot.querySelector('[part~=root]')).backgroundColor==='rgb(237, 246, 250)');await page.screenshot({path:`${out}/${name}-light-mobile.png`});await close(page).click();await gone(page);await page.close();
 });
 await check(`${name}: unavailable Maraca component leaves SSR warnings and native search`,async()=>{
  const {page}=await setup(browser);await page.addInitScript(()=>{window.__alertBootFailed=false;window.addEventListener('xtend-page:error',()=>window.__alertBootFailed=true);});await page.route('**/maraca/chunks/x-alert-*.mjs',r=>r.abort());await page.goto(base+'/search?q=media%20alerts&categories=images');await page.waitForFunction(()=>window.__alertBootFailed);assert.equal(await alerts(page).isVisible(),true);assert.match(await alerts(page).innerText(),/100 Ergebnisse/);assert.equal(await close(page).count(),0);
  await page.locator('#search-input').fill('media');await page.locator('#search-input').press('Enter');await page.waitForURL(u=>u.searchParams.get('q')==='media');await gone(page);await page.close();
 });
 await check(`${name}: no-JS SSR keeps both kinds readable without false close controls`,async()=>{
  const {page}=await setup(browser,{javaScriptEnabled:false});for(const q of ['media alerts','error']){await page.goto(base+'/search?'+new URLSearchParams({q,categories:q==='error'?'general':'images'}));assert.equal(await alerts(page).isVisible(),true);assert.equal(await close(page).count(),0);assert.ok((await alerts(page).innerText()).length>25);}await page.close();
 });
 await browser.close();
}
fs.writeFileSync(out+'/results.json',JSON.stringify({timestamp:new Date().toISOString(),base,note:'Explicit offline Python fixture; media alerts returns 101 results, error raises the fixture engine failure. Image responses use synthetic SVGs. Container assets without overrides.',results},null,2));if(results.some(r=>r.status!=='passed'))process.exitCode=1;
