import {chromium} from '../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch(),out=new URL('./',import.meta.url),report={version:'0.3.5',query:'GNU/ Linux',language:'en',safeSearch:'0',timeRange:'',runs:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8090/?language=en&time_range=&safesearch=0');await page.waitForFunction(()=>window.XTendPage?.getRuntime());const origin=await page.evaluate(()=>performance.timeOrigin);
 await page.locator('#search-input').fill(report.query);await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete',null,{timeout:20000});
 const data=await page.evaluate(()=>window.XTendPage.page.props['search.data']);
 const stream={mode:'XScaler',query:data.state.q,language:data.language,safeSearch:data.safeSearch,timeRange:data.timeRange,count:data.results.length,status:data.statusLabel,sources:[...new Set(data.results.flatMap(r=>r.sourceLabel.split(' · ')))].sort(),sharedHits:data.results.filter(r=>r.sourceLabel.includes(' · ')).map(r=>({url:r.url,sources:r.sourceLabel})),warnings:data.warnings,sameDocument:await page.evaluate(()=>performance.timeOrigin)===origin};report.runs.push(stream);
 await page.screenshot({path:new URL('release-0.3.5-live-search.png',out).pathname,fullPage:true});
 const nojs=await browser.newContext({javaScriptEnabled:false}),ssr=await nojs.newPage();await ssr.goto('http://localhost:8090/search?q=GNU%2F+Linux&categories=general&language=en&time_range=&safesearch=0');const sources=await ssr.locator('.result-sources').allTextContents();report.runs.push({mode:'SSR/no-JS',count:await ssr.locator('article.result').count(),status:await ssr.locator('.source-status summary').textContent(),sources:[...new Set(sources.flatMap(s=>s.split(' · ')))].sort(),sharedHits:sources.filter(s=>s.includes(' · ')).length});await nojs.close();
 await fs.writeFile(new URL('release-0.3.5-live.json',out),JSON.stringify(report,null,2)+'\n');
 for(const run of report.runs){assert.deepEqual(run.sources,['bing','brave','google cse']);assert.ok(run.count>=20);assert.match(run.status,/3 von 3 Quellen mit Treffern/);}
 assert.equal(stream.language,'en');assert.equal(stream.safeSearch,'0');assert.equal(stream.sameDocument,true);assert.ok(stream.sharedHits.length>0);assert.deepEqual(report.errors,[]);report.ok=true;
 await fs.writeFile(new URL('release-0.3.5-live.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){report.error=e.message;await fs.writeFile(new URL('release-0.3.5-live.json',out),JSON.stringify(report,null,2)+'\n');console.error(e);process.exitCode=1;}finally{await browser.close();}
