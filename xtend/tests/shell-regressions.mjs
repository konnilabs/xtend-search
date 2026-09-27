import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:8090';
const evidence=process.env.TEST_EVIDENCE_DIR || 'evidence/tests/shell-fixes';
fs.mkdirSync(evidence,{recursive:true});
const results=[];
async function check(name,run){try{await run();results.push({name,status:'passed'});}catch(error){results.push({name,status:'failed',error:error.stack});}console.log(JSON.stringify(results.at(-1)));}
async function home(page,js,path='/'){await page.goto(base+path);if(js)await page.waitForFunction(()=>window.XTendPage);}
const dark=async page=>page.locator('html').evaluate(e=>getComputedStyle(e).colorScheme==='dark');
for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await engine.launch();
 for(const js of [true,false]){
  await check(`${name} / JS ${js}: home preselection, existing filters, first search`,async()=>{
   const context=await browser.newContext({javaScriptEnabled:js});const page=await context.newPage();let searches=0;
   page.on('request',r=>{if(new URL(r.url()).pathname==='/search')searches++;});
   await home(page,js,'/?language=de&time_range=week&safesearch=2');
   if(js){await page.evaluate(()=>{window.__shell=document.querySelector('#search-shell');window.__input=document.querySelector('#search-input');});await page.locator('#search-input').fill('draft before selection');}
   await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.locator('.tab.active').filter({hasText:'Bilder'}).waitFor();
   assert.equal(await page.locator('input[name=categories]').inputValue(),'images');
   assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).searchParams.get('language'),'de');assert.equal(searches,0);
   if(js){assert.equal(await page.locator('#search-input').inputValue(),'draft before selection');assert.equal(await page.evaluate(()=>window.__input===document.querySelector('#search-input')&&window.__shell===document.querySelector('#search-shell')),true);
    await page.goBack();await page.locator('.tab.active').filter({hasText:'Web'}).waitFor();await page.goForward();await page.locator('.tab.active').filter({hasText:'Bilder'}).waitFor();}
   await page.locator('#search-input').fill('preselected');await page.locator('#search-input').press('Enter');await page.locator('.image-results article').first().waitFor();
   assert.equal(new URL(page.url()).searchParams.get('categories'),'images');assert.equal(new URL(page.url()).searchParams.get('safesearch'),'2');assert.equal(searches,1);
   await context.close();
  });
  await check(`${name} / JS ${js}: dark first paint, filters, results and live scheme switch`,async()=>{
   const context=await browser.newContext({javaScriptEnabled:js,colorScheme:'dark',viewport:{width:1440,height:1000}});const page=await context.newPage();await home(page,js);
   assert.equal(await dark(page),true);assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(14, 25, 34)');
   assert.equal(await page.locator('.search-box').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(23, 41, 53)');
   await page.screenshot({path:`${evidence}/${name}-${js?'js':'native'}-dark-home.png`});
   await page.locator('#filters summary').click();assert.equal(await page.locator('.filter-panel').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(23, 41, 53)');await page.locator('#filters summary').click();
   await page.locator('#search-input').fill('dark results');await page.locator('#search-input').press('Enter');await page.locator('article').first().waitFor();assert.equal(await dark(page),true);
   await page.screenshot({path:`${evidence}/${name}-${js?'js':'native'}-dark-results.png`});
   const before=page.url();await page.emulateMedia({colorScheme:'light'});assert.equal(await dark(page),false);assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(248, 251, 252)');assert.equal(page.url(),before);
   await page.emulateMedia({colorScheme:'dark'});assert.equal(await dark(page),true);
   await context.close();
  });
 }
 await browser.close();
}
fs.writeFileSync(`${evidence}/results.json`,JSON.stringify({timestamp:new Date().toISOString(),base,results},null,2));if(results.some(r=>r.status==='failed'))process.exitCode=1;
