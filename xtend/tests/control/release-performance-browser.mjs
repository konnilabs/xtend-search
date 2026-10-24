// Same browser/host/fixtures for two existing image pairs; the caller switches
// only its isolated Docker fixtures, never the production deployment.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',output=process.env.PERFORMANCE_OUTPUT;
assert(output,'Set PERFORMANCE_OUTPUT explicitly for baseline/candidate evidence');
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'}),admin=await context.newPage(),runs=[];
try{
 const health=await(await fetch(base+'/health/ready')).json();assert(health.ok);
 await admin.goto(base+'/admin');await admin.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).or(admin.getByRole('link',{name:'Anmelden mit CCS Account',exact:true})).click();
 await admin.getByRole('link',{name:'administrator',exact:true}).click();await admin.waitForFunction(()=>window.XTendPage?.getRuntime());
 // Fresh benchmark-only volume, no Knowledge lane or quality rules.
 for(const [id,cap] of [['fixture fast','general'],['fixture medium','general'],['fixture slow','general'],['fixture images','images']]){
  await admin.evaluate(id=>window.XTendPage.visit('/admin?view=sources&engine='+encodeURIComponent(id)),id);const form=admin.locator('#policy-form');await form.waitFor();const revision=await form.locator('[name=revision]').inputValue();
  await form.locator('[name=state]').selectOption('allowed');await form.locator('[name=capabilities]').fill(cap);await form.locator('[name=rpm]').fill('60');await form.locator('[name=concurrency]').fill('4');await form.locator('[name=family]').fill(id.replaceAll(' ','-'));await form.locator('button[type=submit]').click();
  await admin.waitForFunction(rev=>document.querySelector('#policy-form [name=revision]')?.value!==rev,revision);
 }
 await admin.close();
 for(let i=0;i<5;i++){
  const page=await context.newPage(),requests={search:0,metadata:0};page.on('request',r=>{if(r.url().endsWith('/search.run'))requests.search++;if(r.url().endsWith('/search.cache.context'))requests.metadata++;});
  await page.addInitScript(()=>{
   window.perf={start:null,first:null,complete:null,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())if(window.perf.start!==null&&!e.hadRecentInput)window.perf.cls+=e.value;}).observe({type:'layout-shift'});
   addEventListener('xtend-search:stream',({detail})=>{if(window.perf.start===null)return;const ms=performance.now()-window.perf.start;if(document.querySelector('article.result'))window.perf.first??=ms;if(detail.status==='complete')window.perf.complete=ms;});
  });
  await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());await page.locator('#search-input').fill('release-performance-fixture');await page.evaluate(()=>window.perf.start=performance.now());await page.locator('.search-button').click();
  await page.waitForFunction(()=>window.perf.complete!==null&&!document.querySelector('.search-button x-spinner'));
  const values=await page.evaluate(()=>({...window.perf,resultCount:document.querySelectorAll('article.result').length,jsHeapBytes:performance.memory?.usedJSHeapSize??null,jsEncodedBytes:performance.getEntriesByType('resource').filter(r=>/\.mjs(\?|$)/.test(r.name)).reduce((n,r)=>n+r.encodedBodySize,0)}));
  assert.equal(values.resultCount,10);assert.equal(values.cls,0);assert(values.first<values.complete-1000);
  await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='images'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  const before={...requests},start=Date.now();await page.getByRole('link',{name:'Web',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  values.restore={ms:Date.now()-start,searchStreams:requests.search-before.search,metadataRequests:requests.metadata-before.metadata};assert.equal(values.restore.searchStreams,0);assert.equal(values.restore.metadataRequests,1);
  delete values.start;runs.push(values);await page.close();
 }
 const median=key=>runs.map(r=>r[key]).sort((a,b)=>a-b)[2];
 const result={ok:true,version:health.version,scope:'Five same-host desktop runs; independent fresh fixture volume, identical offline 100/700/2500ms providers, no live searches. Heap is a coarse Chromium diagnostic, not a retained-memory benchmark.',runs,median:{firstMs:median('first'),completeMs:median('complete'),jsEncodedBytes:median('jsEncodedBytes'),jsHeapBytes:median('jsHeapBytes'),restoreMs:runs.map(r=>r.restore.ms).sort((a,b)=>a-b)[2]}};
 await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
