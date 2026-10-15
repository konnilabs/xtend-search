import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {VERSION} from '../../shared/version.mjs';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch(),checks=[],errors=[];
const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const complete=()=>page.waitForFunction(()=>window.XTendPage?.page.props['search.data'].stream?.phase==='complete'&&!document.querySelector('.search-button x-spinner'));
const assertCopy=async()=>assert.equal(/\$model\./.test(await page.locator('.empty-state').innerText()),false);
try{
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 await page.locator('#search-input').fill('empty');await page.locator('.search-button').click();await complete();await page.getByRole('heading',{name:'Noch nichts gefunden.',exact:true}).waitFor();await assertCopy();
 let streams=0;page.on('request',r=>{if(r.url().endsWith('/search.run'))streams++;});
 await page.getByRole('link',{name:'Bilder',exact:true}).click();await complete();await assertCopy();const before=streams;await page.goBack();await complete();await assertCopy();assert.equal(streams,before);checks.push('Empty web/image streams and cached Back restore show readable fallback text without model references.');
 const native=await browser.newContext({javaScriptEnabled:false}),nojs=await native.newPage();
 await nojs.goto(base+'/search?q=empty&categories=general');await nojs.getByRole('heading',{name:'Noch nichts gefunden.',exact:true}).waitFor();assert.equal(/\$model\./.test(await nojs.locator('.empty-state').innerText()),false);
 await nojs.goto(base+'/search?q=fixture&categories=general&pageno=2');await nojs.getByRole('heading',{name:'Die Suche ist gerade nicht erreichbar.',exact:true}).waitFor();assert.match(await nojs.locator('.empty-state').innerText(),/Fortsetzungslink/);assert.equal(/\$model\./.test(await nojs.locator('.empty-state').innerText()),false);await native.close();checks.push('Direct SSR and No-JS empty/error paths resolve the same human-readable messages.');
 await page.locator('#search-input').fill('recovered fixture');await page.locator('.search-button').click();await complete();await page.locator('article.result').first().waitFor();assert.equal(await page.locator('.empty-state').count(),0);
 await page.locator('#search-input').fill('error-binding');await page.locator('.search-button').click();await complete();await page.getByRole('heading',{name:'Die Suche ist gerade nicht erreichbar.',exact:true}).waitFor();await assertCopy();assert.match(await page.locator('.empty-state').innerText(),/keine verwertbare Antwort/);checks.push('Successful results replace the empty state; real offline provider failures settle on readable error text and an idle spinner.');
 assert.deepEqual(errors,[]);const report={ok:true,checks,errors,scope:'Built Docker image, explicit offline SearXNG fixtures; no live query or result URL retained.'};await fs.writeFile(new URL(`../../evidence/control-plane/${VERSION}-empty-state-browser.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
