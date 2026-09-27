import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'}),page=await context.newPage(),errors=[],requests=[];
try{
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).pathname==='/favicon')requests.push({domain:new URL(r.url()).searchParams.get('domain'),status:r.status(),type:r.headers()['content-type']});});
 await page.goto('http://localhost:8090/');await page.waitForFunction(()=>window.XTendPage);const origin=await page.evaluate(()=>performance.timeOrigin);await page.locator('#search-input').fill('Python documentation');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete',null,{timeout:20000});await page.waitForTimeout(2500);
 const results=await page.locator('article.result').count(),icons=await page.locator('.favicon-ready').count();assert.ok(results>0);assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);assert.ok(await page.locator('a[data-report]').count()>0);
 await page.screenshot({path:'xtend/evidence/control-plane/release-0.4.0-local-search.png',fullPage:false});
 assert.deepEqual(errors,[]);const report={ok:true,version:(await (await context.request.get('http://localhost:8090/health/ready')).json()).version,results,icons,requests,documentPreserved:true,feedbackNotSubmitted:true,errors};
 await fs.writeFile('xtend/evidence/control-plane/release-0.4.0-local-search.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
