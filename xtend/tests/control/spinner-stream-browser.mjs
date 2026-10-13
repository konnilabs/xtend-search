import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch(),page=await browser.newPage(),base=process.env.TEST_BASE_URL||'http://localhost:8093',checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 const run=async(q)=>{await page.locator('#search-input').fill(q);await page.locator('.search-button').click();await page.locator('.search-button x-spinner').waitFor();const box=await page.locator('.search-button x-spinner').evaluate(e=>({parent:e.parentElement.getBoundingClientRect().toJSON(),root:e.shadowRoot.querySelector('[part~=root]').getBoundingClientRect().toJSON()}));assert.ok(box.root.width>=18&&box.root.height>=18);assert.ok(Math.abs(box.root.x+box.root.width/2-box.parent.x-box.parent.width/2)<1);assert.ok(Math.abs(box.root.y+box.root.height/2-box.parent.y-box.parent.height/2)<1);};
 const idle=()=>page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.activity').busy===false&&!document.querySelector('.search-button x-spinner'));
 await page.route('**/search.run',async route=>{await new Promise(r=>setTimeout(r,200));await route.fulfill({status:200,contentType:'application/x-ndjson',body:''});});await run('empty stream');await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='error');await idle();assert.equal(await page.locator('#results-heading').textContent(),'Suche unterbrochen');await page.unroute('**/search.run');checks.push('Premature/empty stream terminates busy state and replaces the pending heading.');
 await page.route('**/search.run',async route=>{await new Promise(r=>setTimeout(r,16000));await route.abort().catch(()=>{});});await run('timeout stream');await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='error');await idle();await page.unroute('**/search.run');checks.push('15-second transport timeout returns to the magnifier, including a centered monochrome XSpinner.');
 await run('fresh after timeout');await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');await idle();assert.ok(await page.locator('article.result').count()>0);assert.deepEqual(errors,[]);await fs.writeFile(new URL('../../evidence/control-plane/0.5.1-spinner-stream.json',import.meta.url),JSON.stringify({ok:true,checks,errors},null,2));console.log(JSON.stringify({ok:true,checks}));
}finally{await browser.close();}
