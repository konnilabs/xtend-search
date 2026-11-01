import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {VERSION} from '../../shared/version.mjs';
// Run last, on a fresh owned fixture volume: the intentional failures open
// real control-plane guards. Never clear a production guard to run this test.
const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch(),errors=[];
const context=await browser.newContext({viewport:{width:1186,height:892},colorScheme:'dark'}),admin=await context.newPage();
try{
 await admin.goto(base+'/admin');await admin.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).or(admin.getByRole('link',{name:'Anmelden mit CCS Account',exact:true})).click();
 await admin.getByRole('link',{name:'administrator',exact:true}).click();await admin.waitForFunction(()=>window.XTendPage?.getRuntime());
 for(const [id,capability] of [['fixture fast','general'],['fixture medium','general'],['fixture slow','general'],['wikipedia','knowledge']]){
  await admin.evaluate(id=>window.XTendPage.visit('/admin?view=sources&engine='+encodeURIComponent(id)),id);
  const family=capability==='knowledge'?'wikimedia':id.replaceAll(' ','-');
  const form=admin.locator('#policy-form');await form.waitFor();const revision=await form.locator('[name=revision]').inputValue();
  if(await form.locator('[name=state]').inputValue()==='allowed'&&await form.locator('[name=capabilities]').inputValue()===capability&&await form.locator('[name=family]').inputValue()===family&&await form.locator('[name=rpm]').inputValue()==='60'&&await form.locator('[name=concurrency]').inputValue()==='4')continue;
  await form.locator('[name=state]').selectOption('allowed');await form.locator('[name=capabilities]').fill(capability);
  await form.locator('[name=rpm]').fill('60');await form.locator('[name=concurrency]').fill('4');await form.locator('[name=family]').fill(family);
  await form.locator('button[type=submit]').click();await admin.waitForFunction(rev=>document.querySelector('#policy-form [name=revision]')?.value!==rev,revision);
 }
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.cardAudit={firstPhase:null,lost:false,frames:[]};let first=null;
  new MutationObserver(()=>{const card=document.querySelector('.knowledge-card');if(first&&card!==first)window.cardAudit.lost=true;}).observe(document,{subtree:true,childList:true});
  addEventListener('xtend-search:stream',({detail})=>{
   const data=window.XTendPage.page.props['search.data'],card=document.querySelector('.knowledge-card');
   if(card&&!first){first=card;window.cardAudit.firstPhase=data.stream.phase;}
   window.cardAudit.frames.push({event:detail.event,status:detail.status,cards:data.knowledgeCards.length,results:data.results.length,error:data.error});
  });
 });
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 // SafeSearch=0 avoids inventing a Wikipedia filter capability or changing an
 // administrator exception. All engines and data are explicit offline fixtures.
 await page.evaluate(()=>window.XTendPage.visit('/search?q=knowledge-first-web-failure&categories=general&safesearch=0'));
 await page.locator('.knowledge-card').waitFor();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete'&&!document.querySelector('.search-button x-spinner'));
 const audit=await page.evaluate(()=>window.cardAudit),data=await page.evaluate(()=>{
  const d=window.XTendPage.page.props['search.data'];return {error:d.error,empty:d.empty,results:d.results.length,cards:d.knowledgeCards.length,countLabel:d.countLabel,webMessage:d.webMessage};
 });
 assert.equal(audit.firstPhase,'partial');assert.equal(audit.lost,false,'The first rendered card must remain the same connected node');
 assert.equal(data.error,false);assert.equal(data.empty,false);assert.equal(data.results,0);assert.equal(data.cards,1);
 assert.equal(data.countLabel,'Informationen zur Suche');assert.match(data.webMessage,/Webquellen.*nicht verfügbar/);
 assert.equal(audit.frames.filter(f=>f.event==='source.status').length,3);assert.ok(audit.frames.filter(f=>f.cards).every(f=>f.cards===1&&!f.error));
 assert.equal(await page.locator('.empty-state[role=alert]').count(),0);await page.locator('.web-source-notice').waitFor();
 const native=await browser.newContext({javaScriptEnabled:false}),nojs=await native.newPage();
 await nojs.goto(base+'/search?q=knowledge-first-web-failure&categories=general&safesearch=0');
 assert.equal(await nojs.locator('.knowledge-card').count(),1);assert.equal(await nojs.locator('.empty-state[role=alert]').count(),0);
 await nojs.locator('.web-source-notice').waitFor();await native.close();
 assert.deepEqual(errors,[]);
 await page.screenshot({path:new URL(`../../evidence/control-plane/${VERSION}-knowledge-web-failure.png`,import.meta.url).pathname,fullPage:true});
 const report={ok:true,scope:'Built paired images; an offline Knowledge Card arrives first, then three real SearXNG fixture failures; no user queries, URLs or production policies retained.',audit,data,errors};
 await fs.writeFile(new URL(`../../evidence/control-plane/${VERSION}-knowledge-web-failure.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
