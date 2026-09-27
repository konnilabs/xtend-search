import {chromium} from '../../node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base='http://localhost:8093',out=new URL('./',import.meta.url),checks=[],errors=[];
const browser=await chromium.launch();let page;
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin');await page.getByRole('link',{name:'Mit Nextcloud anmelden'}).click();await page.getByRole('link',{name:'administrator',exact:true}).click();await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 assert.equal((await (await context.request.get(base+'/health/ready')).json()).version,'0.3.5');
 for(const id of ['fixture fast','fixture medium','fixture slow']) {
  await page.locator('.engine-choice').filter({hasText:id}).click();await page.waitForFunction(id=>document.querySelector('.engine-detail h3')?.textContent===id,id);
  const before=await page.locator('#policy-form input[name=revision]').inputValue();
  await page.locator('#policy-form select[name=state]').selectOption('allowed');await page.locator('#policy-form input[name=capabilities]').fill('general');await page.locator('#policy-form input[name=rpm]').fill('60');await page.locator('#policy-form input[name=concurrency]').fill('4');await page.locator('#policy-form input[name=family]').fill(id.replaceAll(' ','-'));
  await page.getByRole('button',{name:'Policy verbindlich speichern'}).click();await page.waitForFunction(before=>document.querySelector('#policy-form input[name=revision]').value!==before,before);
 }
 await page.goto(base+'/?language=all&safesearch=0');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 const origin=await page.evaluate(()=>performance.timeOrigin);
 await page.evaluate(()=>{window.framesSeen=[];window.addEventListener('xtend-search:stream',e=>{const row=[...document.querySelectorAll('article.result')].find(r=>r.querySelector('h2 a')?.href==='https://example.org/shared/1');if(row&&!window.firstRow){window.firstRow=row;window.firstTitle=row.querySelector('h2').textContent;}window.framesSeen.push({phase:e.detail.status,rows:document.querySelectorAll('article.result').length,label:row?.querySelector('.result-sources')?.textContent,stable:!row||row===window.firstRow});});});
 await page.locator('#search-input').fill('GNU/ Linux');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 const streamed=await page.evaluate(()=>({data:window.XTendPage.page.props['search.data'],frames:window.framesSeen,title:window.firstTitle,stillConnected:window.firstRow?.isConnected}));
 assert.equal(streamed.data.results.length,10);const shared=streamed.data.results.find(r=>r.url==='https://example.org/shared/1');assert.equal(shared.sourceLabel,'fixture fast · fixture medium · fixture slow');assert.equal(shared.title,streamed.title);assert.ok(streamed.stillConnected);assert.ok(streamed.frames.every(f=>f.stable));assert.ok(streamed.frames.some(f=>f.label==='fixture fast'));assert.ok(streamed.frames.some(f=>f.label==='fixture fast · fixture medium'));assert.equal(streamed.data.statusLabel,'3 von 3 Quellen mit Treffern');assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
 checks.push('Three delayed sources stream through gzip/XScaler; duplicate row keeps its DOM identity, title and position while all three attributions appear; no document reload.');
 const nojs=await browser.newContext({javaScriptEnabled:false}),ssr=await nojs.newPage();await ssr.goto(base+'/search?q=GNU%2F+Linux&categories=general&language=all&safesearch=0');assert.equal(await ssr.locator('article.result').count(),10);assert.equal(await ssr.locator('.result-sources').filter({hasText:'fixture fast · fixture medium · fixture slow'}).count(),1);await nojs.close();checks.push('Direct SSR without JavaScript has the same ten unique hits and combined provenance.');
 const mobile=[];
 await page.goto(base+'/search?q=GNU%2F+Linux&categories=general&language=en&safesearch=0');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});const details=page.locator('.source-status');if(!(await details.getAttribute('open')!==null))await details.locator('summary').click();
  const m=await page.evaluate(()=>{const s=document.querySelector('.source-status'),sum=s.querySelector('summary').getBoundingClientRect(),pop=s.querySelector('.source-status-popover').getBoundingClientRect();return {width:innerWidth,status:s.textContent,summaryHeight:sum.height,statusHeight:s.getBoundingClientRect().height,popupTop:pop.top,summaryBottom:sum.bottom,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};});
  assert.equal(m.overflow,false);assert.ok(m.statusHeight>=m.summaryHeight);assert.ok(m.popupTop>=m.summaryBottom-1);assert.match(m.status,/3 weitere nicht berücksichtigt/);for(const id of ['fixture fast','fixture medium','fixture slow'])assert.ok(m.status.includes(id));mobile.push(m);
 }
 await page.screenshot({path:new URL('release-0.3.5-mobile-status.png',out).pathname});checks.push('Excluded approved sources are named; wrapping status and its popup fit 320px and 390px viewports.');
 await page.goto(base+'/?language=all&safesearch=0');await page.waitForFunction(()=>window.XTendPage?.getRuntime());await page.locator('#search-input').fill('error');await page.getByRole('button',{name:'Suchen',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 const failure=await page.evaluate(()=>window.XTendPage.page.props['search.data']);assert.match(failure.statusLabel,/0 von 3 Quellen mit Treffern · 3 fehlgeschlagen/);assert.equal(failure.warnings.length,3);for(const id of ['fixture fast','fixture medium','fixture slow'])assert.ok(failure.warnings.some(w=>w.message.startsWith(id+':')));assert.ok(!JSON.stringify(failure.warnings).includes('synthetic failure'));checks.push('Provider failures produce named, allowlisted diagnostics and an honest zero-of-three contribution status.');
 assert.deepEqual(errors,[]);const report={ok:true,version:'0.3.5',checks,frames:streamed.frames,mobile,failure:{status:failure.statusLabel,warnings:failure.warnings},errors};await fs.writeFile(new URL('release-0.3.5-browser.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} catch(e) {await page?.screenshot({path:new URL('release-0.3.5-browser-failure.png',out).pathname,fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;} finally {await browser.close();}
