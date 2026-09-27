import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base='http://127.0.0.1:8080',out='evidence/tests/image-fallback',browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1000},colorScheme:'dark'}),errors=[],foreign=[],failures=[];page.setDefaultTimeout(20000);
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))foreign.push(r.url());});page.on('response',r=>{if(r.url().includes('/image_proxy?') && r.status()>=400)failures.push({source:new URL(r.url()).searchParams.get('url'),status:r.status()});});
try{
 assert.equal((await fetch(base+'/health/ready')).status,200);
 await page.goto(base+'/search?q=ubuntu&categories=images');await page.waitForFunction(()=>window.XTendPage);assert.equal(await page.evaluate(()=>XTendPage.page.props['search.data'].fixture),false);
 await page.locator('.result-image[data-unavailable]').first().waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.result-image:not([data-unavailable]) img')).some(img=>img.naturalWidth>0));
 const candidates=await page.locator('.result-image:not([data-unavailable])').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('img').naturalWidth>0).map(n=>n.dataset.previewId));
 const bad=await page.locator('.result-image[data-unavailable]').first().getAttribute('data-preview-id');await page.screenshot({path:out+'/live-grid.png'});await page.evaluate(()=>window.__imageLiveDocument=document);
 await page.locator(`a[data-preview-id="${bad}"]`).click();await page.locator('.preview-placeholder img').waitFor();const badTitle=await page.locator('#image-preview h2').innerText();await page.screenshot({path:out+'/live-unavailable.png'});
 let recovered=null;
 for(const id of candidates.slice(0,4)){
  await page.locator(`a[data-preview-id="${id}"]`).click();
  try{await page.waitForFunction(()=>document.querySelector('#preview-image')?.complete && document.querySelector('#preview-image')?.naturalWidth>0,{},{timeout:10000});recovered=id;break;}catch{}
 }
 assert.ok(recovered,'A real available image must recover the same sidebar');await page.locator('#preview-image').evaluate(img=>img.decode());assert.ok((await page.locator('#preview-image').boundingBox()).width>0);const goodTitle=await page.locator('#image-preview h2').innerText();assert.equal(await page.locator('.preview-placeholder').count(),0);assert.equal(await page.evaluate(()=>document===window.__imageLiveDocument),true);await page.screenshot({path:out+'/live-recovered.png'});
 await page.locator('#preview-expand').click();await page.locator('x-lightbox[open]').waitFor();await page.waitForFunction(()=>!document.querySelector('x-lightbox').hasAttribute('data-loading'));await page.keyboard.press('Escape');assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);
 fs.writeFileSync(out+'/live.json',JSON.stringify({timestamp:new Date().toISOString(),base,query:'ubuntu',fixture:false,placeholders:await page.locator('.result-image[data-unavailable]').count(),badTitle,goodTitle,sameDocument:true,recovered:true,lightboxOpened:true,errors,foreign,failures,health:200},null,2));console.log(JSON.stringify({badTitle,goodTitle,recovered:true,networkFailures:failures.length}));
}finally{await browser.close();}
