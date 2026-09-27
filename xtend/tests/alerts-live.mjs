import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base='http://127.0.0.1:8080',out='evidence/tests/alerts',browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1000},colorScheme:'dark'}),errors=[],requests=[];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
try{
 const health=await fetch(base+'/health/ready');assert.equal(health.status,200);
 await page.goto(base+'/search?q=Mozilla%20Firefox&categories=images');await page.waitForFunction(()=>window.XTendPage);const data=await page.evaluate(()=>window.XTendPage.page.props['search.data']);assert.equal(data.fixture,false);
 const alerts=page.locator('x-alert.search-warning'),n=await alerts.count();assert.ok(n>0,'Live response must provide notices for this check');await alerts.first().getByRole('button',{name:'Schliessen'}).waitFor();await page.screenshot({path:out+'/live-dark.png'});
 await page.evaluate(()=>window.__alertsLiveDocument=document);
 const dismissed=[];
 for(let left=n;left>0;left--){dismissed.push(await alerts.first().innerText());await alerts.first().getByRole('button',{name:'Schliessen'}).focus();await page.keyboard.press('Enter');await page.waitForFunction(n=>document.querySelectorAll('x-alert.search-warning').length===n,left-1);await page.waitForFunction(()=>document.activeElement?.tagName==='X-ALERT' || document.activeElement?.id==='results-heading');}
 if(data.results.some(r=>r.previewId)){await page.locator('a[data-preview-id]').first().click();await page.locator('#image-preview').waitFor();assert.equal(await alerts.count(),0);}
 assert.equal(await page.evaluate(()=>document===window.__alertsLiveDocument),true);assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(x=>!x.startsWith(base)),[]);
 fs.writeFileSync(out+'/live.json',JSON.stringify({timestamp:new Date().toISOString(),base,query:data.q,fixture:data.fixture,resultCount:data.results.length,noticeCount:n,types:data.warnings.map(w=>w.type),dismissed,focusAfterLastClose:'results-heading',sameDocument:true,persistedThroughSidebar:true,errors,foreignRequests:0,health:health.status},null,2));console.log(JSON.stringify({results:data.results.length,notices:n,types:data.warnings.map(w=>w.type),ok:true}));
}finally{await browser.close();}
