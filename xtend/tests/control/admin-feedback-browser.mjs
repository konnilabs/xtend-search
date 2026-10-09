import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const out=new URL('../../evidence/control-plane/',import.meta.url),checks=[],widths=[];
const browser=await chromium.launch();let page;
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},colorScheme:'dark'});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin');await page.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).or(page.getByRole('link',{name:'Anmelden mit CCS Account',exact:true})).click();await page.getByRole('link',{name:'administrator',exact:true}).click();await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 const health=await context.request.get(base+'/health/ready');assert.equal((await health.json()).version,'0.3.5');assert.equal(health.headers()['x-xtend-version'],'0.3.5');
 const css=await context.request.get(base+'/assets/xtend/admin/admin.css');assert.equal(css.headers()['cache-control'],'private, no-store');
 assert.equal(await page.getByText('XTend.search 0.3.5 · Powered by SearXNG',{exact:true}).count(),1);
 const nojs=await browser.newContext({storageState:await context.storageState(),javaScriptEnabled:false,viewport:{width:1920,height:1080}}),ssr=await nojs.newPage();await ssr.goto(base+'/admin');
 const ssrWidth=await ssr.evaluate(()=>({viewport:document.documentElement.clientWidth,main:document.querySelector('.admin-main').getBoundingClientRect().width}));assert.equal(ssrWidth.main,ssrWidth.viewport);await nojs.close();
 checks.push('Release 0.3.5 is identifiable through health, response header and footer; authenticated CSS is not cached; no-JS SSR fills the viewport.');
 await page.evaluate(()=>{window.toastEvents=[];document.addEventListener('toast-shown',e=>window.toastEvents.push(e.detail));});
 assert.equal(await page.locator('.admin-toast').count(),0);
 for(const width of [320,390,720,1440,1920,2560,3840]){
  await page.setViewportSize({width,height:1080});const box=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,header:document.querySelector('.admin-header').getBoundingClientRect().width,main:document.querySelector('.admin-main').getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
  assert.equal(box.header,box.viewport);assert.equal(box.main,box.viewport);assert.equal(box.overflow,false);widths.push(box);
 }
 checks.push('The upgraded XSection, header and main fill the viewport from 320 to 3840px without horizontal overflow.');
 await page.setViewportSize({width:1920,height:1080});await page.screenshot({animations:'disabled',path:new URL('admin-full-width-1920.png',out).pathname});
 const source=page.locator('.engine-choice').filter({hasText:'fixture fast'});await source.click();await page.waitForURL(/engine=fixture\+fast/);await page.waitForFunction(()=>document.querySelector('.engine-detail h3').textContent==='fixture fast');
 const save=page.getByRole('button',{name:'Policy verbindlich speichern',exact:true});
 async function policy(state,caps='general'){
  await page.locator('#policy-form select[name=state]').selectOption(state);await page.locator('#policy-form input[name=capabilities]').fill(caps);
  await page.locator('#policy-form input[name=family]').fill('fixture-fast');
  await save.click();await page.waitForFunction(()=>['success','error'].includes(window.XTendPage.getRuntime().model.getState('admin.request').status));
 }
 const toast=page.locator('x-toast.admin-toast');
 await policy('allowed');await page.waitForFunction(()=>document.querySelector('x-toast.admin-toast')?.shadowRoot);assert.equal(await toast.getAttribute('type'),'success');assert.match(await toast.textContent(),/Quelle freigegeben/);assert.equal(await toast.locator('[role=status]').count(),1);
 assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'Policy verbindlich speichern');
 assert.ok(await toast.isVisible());await page.screenshot({animations:'disabled',path:new URL('admin-toast-success.png',out).pathname});
 await toast.waitFor({state:'detached',timeout:10000});const announced=await page.evaluate(()=>window.toastEvents.length);
 await page.evaluate(()=>window.XTendPage.getRuntime().dispatchCommand('admin.connection.set',{message:'Live verbunden · Präsentation geprüft'}));assert.equal(await toast.count(),0);assert.equal(await page.evaluate(()=>window.toastEvents.length),announced);
 checks.push('An approval produces one genuine XToast after the confirmed save, keeps focus in the form, expires, and is not resurrected by unrelated renders.');
 await policy('disabled');assert.match(await toast.textContent(),/Quelle gesperrt/);assert.equal(await toast.getAttribute('type'),'info');
 await toast.getByRole('button',{name:'Schliessen',exact:true}).click();await toast.waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement?.matches('#policy-form button[type=submit]'));
 await policy('allowed');assert.match(await toast.textContent(),/Quelle freigegeben/);await toast.getByRole('button',{name:'Schliessen',exact:true}).click();await toast.waitFor({state:'detached'});
 checks.push('Source blocking and repeated approval show fresh action-specific notices; close returns keyboard focus to the initiating control without scrolling.');
 await policy('allowed','images');assert.equal(await toast.getAttribute('type'),'error');assert.match(await toast.textContent(),/Nicht unterstützte Capability/);assert.equal(await toast.locator('[role=alert]').count(),1);assert.equal(await toast.getAttribute('duration'),'0');
 await page.waitForTimeout(6500);assert.ok(await toast.isVisible());assert.equal(await page.locator('x-toast[type=success]').count(),0);
 await page.setViewportSize({width:390,height:844});const r=await toast.boundingBox();assert.ok(r.x>=0&&r.x+r.width<=390);assert.ok(r.y>=0&&r.y+r.height<=844);
 await page.screenshot({animations:'disabled',path:new URL('admin-toast-error-mobile.png',out).pathname});await toast.getByRole('button',{name:'Schliessen',exact:true}).click();await toast.waitFor({state:'detached'});
 checks.push('Rejected changes produce a persistent accessible error toast and no success message; feedback stays inside the mobile viewport and is dismissible.');
 await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});await policy('disabled');assert.equal(await toast.evaluate(e=>getComputedStyle(e).animationName),'none');await toast.getByRole('button',{name:'Schliessen',exact:true}).click();await toast.waitFor({state:'detached'});
 checks.push('Reduced-motion preference is respected by the native component; the test source is disabled again.');
 assert.deepEqual(errors,[]);const result={ok:true,checks,widths};await fs.writeFile(new URL('admin-feedback-browser.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){console.error(await page?.evaluate(()=>({active:document.activeElement?.outerHTML.slice(0,400),events:window.toastEvents,request:window.XTendPage?.getRuntime().model.getState('admin.request')})).catch(()=>null));await page?.screenshot({path:new URL('admin-feedback-failure.png',out).pathname,fullPage:true}).catch(()=>{});console.error(error);process.exitCode=1;}finally{await browser.close();}
