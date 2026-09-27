import {chromium} from '../../node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const base='http://localhost:8090',browser=await chromium.launch(),reports=[];
function expected(data){assert.equal(data.category,'images');assert.match(data.status,/2 von 2 Quellen/);assert.deepEqual(data.sources.sort(),['bing images','google cse images']);assert.ok(data.results>20);}
async function read(p){return p.evaluate(()=>{const d=window.XTendPage.page.props['search.data'];return {category:d.category,status:d.statusLabel,count:d.countLabel,results:d.results.length,sources:[...new Set(d.results.map(r=>r.sourceLabel))],warnings:d.warnings,phase:d.stream?.phase};});}
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/media?*',r=>r.abort());
 const response=await page.goto(base+'/search?q=open+source&categories=images&language=de&time_range=&safesearch=1');assert.equal(response.headers()['x-xtend-version'],'0.3.4');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 const ssr=await read(page);expected(ssr);reports.push({mode:'SSR',...ssr});
 await page.goto(base+'/?categories=images&language=de&time_range=&safesearch=1');await page.waitForFunction(()=>window.XTendPage?.getRuntime());const origin=await page.evaluate(()=>performance.timeOrigin);
 await page.locator('#search-input').fill('open source');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 const stream=await read(page);expected(stream);assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);reports.push({mode:'XScaler',...stream});
 const context=await browser.newContext({javaScriptEnabled:false}),np=await context.newPage();await np.route('**/media?*',r=>r.abort());await np.goto(base+'/search?q=open+source&categories=images&language=de&time_range=&safesearch=1');
 const count=await np.locator('article.result').count(),sources=[...new Set(await np.locator('.result-sources').allTextContents())];assert.ok(count>20);assert.deepEqual(sources.sort(),['bing images','google cse images']);reports.push({mode:'no-JS',results:count,sources});await context.close();assert.deepEqual(errors,[]);
 const health=await(await page.request.get(base+'/health/ready')).json();const result={ok:true,reports,errors,health};console.log(JSON.stringify(result,null,2));await fs.writeFile(new URL('release-0.3.4-live.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
}finally{await browser.close();}
