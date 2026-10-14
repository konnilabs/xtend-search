import {VERSION} from '../../shared/version.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',stats=process.env.WEATHER_FIXTURE_STATS||'http://localhost:8094/weather-stats';
const browser=await chromium.launch(),context=await browser.newContext(),admin=await context.newPage(),page=await context.newPage(),errors=[],checks=[];
for(const p of [admin,page])p.on('pageerror',e=>errors.push(e.message));
const visit=async url=>admin.evaluate(url=>window.XTendPage.visit(url),url);
const guard=()=>admin.locator('#admin-draft-guard');
const weatherDone=()=>page.waitForFunction(()=>window.XTendPage.page.props['search.data'].weather?.hasForecast&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
try{
 await admin.goto(base+'/admin');await admin.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).or(admin.getByRole('link',{name:'Anmelden mit CCS Account',exact:true})).click();await admin.getByRole('link',{name:'administrator',exact:true}).click();await admin.waitForFunction(()=>window.XTendPage);
 await visit('/admin?view=appearance');await admin.locator('#motd-messages').fill('Fixture daily A\nFixture daily B');await admin.locator('#motd-override').fill('Fixture manual');
 // Two dirty forms must be committed sequentially with fresh revision/security metadata.
 let saves=0;admin.on('request',r=>{if(r.url().endsWith('/admin.motd.set'))saves++;});
 await admin.getByRole('link',{name:'Übersicht',exact:true}).click();await guard().locator('[data-choice=save]').click();await admin.waitForURL(/view=overview/);assert.equal(saves,2);
 await admin.reload();await admin.waitForFunction(()=>window.XTendPage);let saved=await admin.evaluate(()=>window.XTendPage.page.props['admin.data'].motd);assert.deepEqual(saved.messages,['Fixture daily A','Fixture daily B']);assert.equal(saved.message,'Fixture manual');checks.push('Dialog save persists two drafts before navigation; independent document reload verifies stored values.');
 await visit('/admin?view=appearance');await admin.locator('#motd-override').fill('Fixture retry');await admin.getByRole('link',{name:'Übersicht',exact:true}).click();
 await admin.route('**/admin.motd.set',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({schema:'xtend.maraca.app-service-response.v1',ok:false,error:{code:'fixture',message:'Fixture save unavailable'}})}));
 await guard().locator('[data-choice=save]').click();await admin.locator('x-toast.admin-toast').filter({hasText:/Fixture|503|unavailable/}).waitFor();assert.match(admin.url(),/view=appearance/);assert.equal(await guard().getAttribute('open'),'');assert.equal(await admin.locator('#motd-override').inputValue(),'Fixture retry');
 await admin.unroute('**/admin.motd.set');await guard().locator('[data-choice=save]').click();await admin.waitForURL(/view=overview/);await admin.reload();await admin.waitForFunction(()=>window.XTendPage);assert.equal(await admin.evaluate(()=>window.XTendPage.page.props['admin.data'].motd.message),'Fixture retry');checks.push('Failed dialog save keeps dialog and inputs; retry persists without an extra manual form save.');
 await visit('/admin?view=sources&engine=fixture%20fast');
 await admin.locator('#policy-form [name=rpm]').fill('58');await admin.locator('#policy-form [name=concurrency]').fill('3');await admin.locator('#policy-form [name=state]').selectOption('allowed');
 await admin.getByRole('link',{name:'Übersicht',exact:true}).click();await guard().locator('[data-choice=save]').click();await admin.waitForURL(/view=overview/);
 await admin.goto(base+'/admin?view=sources&engine=fixture%20fast');await admin.waitForFunction(()=>window.XTendPage);assert.equal(await admin.locator('#policy-form [name=rpm]').inputValue(),'58');assert.equal(await admin.locator('#policy-form [name=concurrency]').inputValue(),'3');assert.equal(await admin.locator('#policy-form [name=state]').inputValue(),'allowed');checks.push('Engine policy values saved through the guard are verified in a fresh document.');
 await visit('/admin?view=weather');await admin.locator('#weather-policy-form [name=enabled]').check();const revision=await admin.locator('#weather-policy-form [name=revision]').inputValue();await admin.locator('#weather-policy-form button[type=submit]').click();await admin.waitForFunction(revision=>document.querySelector('#weather-policy-form [name=revision]')?.value!==revision,revision);
 await page.goto(base+'/?categories=weather&language=all&time_range=&safesearch=1');await page.waitForFunction(()=>window.XTendPage);await page.locator('#search-input').fill('Berlin');await page.locator('.search-button').click();await page.locator('.weather-place').first().click();await weatherDone();
 const selected=await page.evaluate(()=>window.XTendPage.page.props['search.data'].weather.place.id);await page.waitForFunction(()=>window.XTendSearchCacheStats().entries>=2);
 let streams=0,pages=0,metadata=0;page.on('request',r=>{if(r.url().endsWith('/search.weather.run'))streams++;if(r.headers()['x-xtend-page'])pages++;if(r.url().endsWith('/search.weather.cache.context'))metadata++;});
 await page.getByRole('link',{name:'Web',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 const before=await(await fetch(stats)).json(),pageCount=pages;await page.getByRole('link',{name:'Wetter',exact:true}).click();await weatherDone();assert.equal(streams,0);assert.equal(pages,pageCount);assert.equal(metadata,1);assert.deepEqual(await(await fetch(stats)).json(),before);assert.equal(await page.evaluate(()=>window.XTendPage.page.props['search.data'].weather.place.id),selected);assert.equal(new URL(page.url()).searchParams.get('location'),String(selected));assert.equal(await page.locator('.weather-place').count(),0);
 await page.goBack();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general');await page.goForward();await weatherDone();assert.equal(streams,0);assert.deepEqual(await(await fetch(stats)).json(),before);checks.push('Weather → Web → Weather tab and Back/Forward restore the chosen city with zero page requests, zero weather streams and zero provider calls.');
 await page.locator('.search-button').click();await page.locator('.weather-place').first().waitFor();assert.equal(streams,1);checks.push('Explicit same-query search starts a new service run and offers location selection again.');
 assert.deepEqual(errors,[]);await fs.writeFile(new URL(`../../evidence/control-plane/${VERSION}-shell-recovery-browser.json`,import.meta.url),JSON.stringify({ok:true,checks,errors,restoredWeatherStreams:0,restoredProviderCalls:0},null,2)+'\n');console.log(JSON.stringify({ok:true,checks}));
}finally{await browser.close();}
