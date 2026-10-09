import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {decodePageWire,encodePageWire} from '../../node_modules/@ccslabs/xtend/xtendrmt/page-wire.mjs';
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const baseline=process.env.SSR_BASELINE_URL;
const checks=[],browser=await chromium.launch();
const extract=html=>html.match(/id="xtend-page-data"[^>]*>([\s\S]*?)<\/script>/)[1];
async function measure(url){
 const response=await fetch(url),html=await response.text(),raw=extract(html),page=decodePageWire(JSON.parse(raw));
 const htmlCopies=[page.ssr.chunk,...page.ssr.chunks].map(c=>c.markup.html).filter(Boolean);
 const tag=html.match(/<input[^>]*id="search-input"[^>]*>/)[0],type=tag.match(/\btype="([^"]*)"/)?.[1];
 return {htmlBytes:Buffer.byteLength(html),htmlGzipBytes:gzipSync(html).length,wireBytes:Buffer.byteLength(raw),wireGzipBytes:gzipSync(raw).length,snapshotStateBytes:Buffer.byteLength(JSON.stringify(page.ssr.resume.snapshot.state)),duplicateHtmlFields:htmlCopies.length,uniqueDuplicateHtmlBytes:[...new Set(htmlCopies)].reduce((n,s)=>n+Buffer.byteLength(s),0),inputTypeBytes:Buffer.byteLength(type),inputTypeIsSearch:type==='search',coverage:page.ssr.hydration.coverage||null,missingCapabilityDiagnostics:page.ssr.diagnostics.filter(d=>d.code==='rmt.node_ssr.component_capability_missing').length};
}
try{
 const metrics={baseline:baseline?await measure(baseline+'/'):null,patched:await measure(base+'/')};
 assert.equal(metrics.patched.inputTypeIsSearch,true);assert.equal(metrics.patched.duplicateHtmlFields,0);
 assert.equal(metrics.patched.missingCapabilityDiagnostics,0);assert.equal(metrics.patched.coverage.missingCapabilityNodes,0);
 assert.equal(metrics.patched.coverage.resumeMarkerCoverage,1);
 if(metrics.baseline)assert.ok(metrics.patched.wireBytes<metrics.baseline.wireBytes);
 // Guard payload growth without deleting state used by reducers and recovery.
 assert.ok(metrics.patched.wireBytes<120000);checks.push('Initial wire is measured and bounded; input literal, registry coverage and absence of duplicate HTML are asserted.');
 for(const tampered of [false,true]){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.ssrProbe={resume:null,errors:[]};
   addEventListener('xtend-page:capturing',()=>{window.initialSearchInput=document.getElementById('search-input');});
   addEventListener('xtend-page:event',({detail})=>{if(detail.type==='resume')window.ssrProbe.resume={status:detail.result.status,verified:detail.result.verified};});
   addEventListener('xtend-page:error',({detail})=>window.ssrProbe.errors.push(detail.code||detail.message));
  });
  if(tampered)await page.route(base+'/',async route=>{
   const response=await route.fetch(),html=await response.text(),raw=extract(html),wire=decodePageWire(JSON.parse(raw));
   wire.ssr.resume.integrity.signature='AAAA';
   const replacement=JSON.stringify(encodePageWire(wire)).replace(/</g,'\\u003c');
   await route.fulfill({response,body:html.replace(raw,replacement)});
  });
  await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage && window.ssrProbe.resume);
  const resumed=await page.evaluate(()=>({...window.ssrProbe,preserved:window.initialSearchInput===document.getElementById('search-input'),type:document.getElementById('search-input').type}));
  assert.equal(resumed.resume.status,tampered?'fallback_hydrated':'resumed');
  assert.equal(resumed.resume.verified,!tampered);if(!tampered)assert.equal(resumed.preserved,true);
  assert.equal(resumed.type,'search');assert.deepEqual(resumed.errors,[]);
  const origin=await page.evaluate(()=>performance.timeOrigin);
  await page.locator('#search-input').fill(tampered?'fallback search':'resumed search');
  await page.getByRole('button',{name:'Suchen',exact:true}).click();
  await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  assert.equal(await page.locator('article.result').count(),10);assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
  await page.getByRole('link',{name:'Bilder',exact:true}).click();
  await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
  await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].state.category==='general');
  assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);assert.deepEqual(errors,[]);
  checks.push(tampered?'Invalid signature recovers through descriptors; stream and history work without HTML copy.':'Verified resume preserves the SSR input; stream and history work without document replacement.');
  await context.close();
 }
 const nojs=await browser.newContext({javaScriptEnabled:false}),page=await nojs.newPage();
 await page.goto(base+'/search?q=native&categories=general&language=all&safesearch=1');
 assert.equal(await page.locator('#search-input').getAttribute('type'),'search');
 assert.equal(await page.locator('article.result').count(),10);await nojs.close();checks.push('No-JS direct SSR search keeps the native search input and results.');
 const report={ok:true,date:new Date().toISOString(),checks,metrics,scope:'Local Docker 0.4.2; optional baseline URL is measured separately. Signed state, timestamps and signatures vary. Byte/gzip comparison is transport size, not a production latency claim. Marker coverage is not a successful-resume ratio.'};
 await fs.writeFile(new URL('../../evidence/control-plane/0.4.2-ssr-browser.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
