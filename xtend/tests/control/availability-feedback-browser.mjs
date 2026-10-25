import {VERSION} from '../../shared/version.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
const admin=await context.newPage(),search=await context.newPage(),checks=[],errors=[];
for(const page of [admin,search])page.on('pageerror',error=>errors.push(error.message));
let original;
async function saveWeather(enabled,paused=false){
 const form=admin.locator('#weather-policy-form'),revision=await form.locator('[name=revision]').inputValue();
 await form.locator('[name=enabled]').setChecked(enabled);await form.locator('[name=paused]').setChecked(paused);
 await form.locator('button[type=submit]').click();
 await admin.waitForFunction(revision=>document.querySelector('#weather-policy-form [name=revision]')?.value!==revision,revision);
}
async function dismissAll(){
 while(await admin.locator('x-toast.admin-toast').count()){
  const toast=admin.locator('x-toast.admin-toast').first(),id=await toast.getAttribute('id');
  await toast.getByRole('button',{name:'Schliessen',exact:true}).click();
  await admin.locator('[id="'+id+'"]').waitFor({state:'detached'});
 }
}
async function tabs(url,shown){
 await search.goto(base+url);await search.waitForFunction(()=>window.XTendPage?.getRuntime());
 assert.equal(await search.locator('.category-tabs a').filter({hasText:/^Wetter$/}).count(),shown?1:0);
 const native=await browser.newContext({javaScriptEnabled:false}),page=await native.newPage();
 try{await page.goto(base+url);assert.equal(await page.locator('.category-tabs a').filter({hasText:/^Wetter$/}).count(),shown?1:0);}finally{await native.close();}
}
async function filterGeometry(page,width,mode='resume'){
 await page.setViewportSize({width,height:1000});await page.locator('#filters>summary').click();await page.locator('#language').waitFor({state:'visible'});
 await page.locator('#search-filter-panel').evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
 const geometry=await page.locator('#search-filter-panel').evaluate(element=>{const box=element.getBoundingClientRect(),field=document.getElementById('language').getBoundingClientRect();return {width:box.width,left:box.left,right:box.right,fieldWidth:field.width,viewport:innerWidth,formWidth:document.getElementById('search-form').getBoundingClientRect().width};});
 assert.ok(Math.abs(geometry.width-Math.min(680,width>600?geometry.formWidth:width-32))<1,JSON.stringify(geometry));assert.ok(geometry.left>=-1&&geometry.right<=width+1);assert.ok(geometry.fieldWidth>=230,'select is readable: '+JSON.stringify(geometry));
 const actions=await page.locator('.filter-actions>button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left};}));
 assert.equal(actions.length,3);assert.ok(actions.every(button=>button.height>=44&&Math.abs(button.width-actions[0].width)<1&&Math.abs(button.left-actions[0].left)<1));
 assert.ok(actions.slice(1).every((button,i)=>button.top-actions[i].bottom>=9.5),'Action slots need consistent 10px gaps: '+JSON.stringify(actions));
 if(width===320||width===1308)await page.screenshot({path:new URL(`../../evidence/control-plane/${VERSION}-filter-panel-`+width+'-'+mode+'.png',import.meta.url).pathname});
 await page.locator('#filters>summary').click();await page.locator('#language').waitFor({state:'hidden'});return {...geometry,mode,actions};
}
async function reportAppearance(category,colorScheme,width,knowledge=false){
 console.log('Report appearance:',category,colorScheme,width,knowledge?'knowledge':'result');
 await search.setViewportSize({width,height:1000});await search.emulateMedia({colorScheme});
 await search.goto(base+'/search?q=report-appearance-fixture&categories='+category+'&safesearch=0');
 await search.waitForFunction(()=>window.XTendPage?.getRuntime()?.model.getState('search.activity').busy===false);
 if(category==='images')await search.locator('.result-image').first().click();
 await search.locator('#report-start').click();
 await search.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.feedback').open&&document.activeElement?.id==='report-reason');
 const target=search.locator(knowledge?'.knowledge-card':'.result').first(),checkbox=target.locator('.report-checkbox');
 const selector=knowledge?'.knowledge-card':'.result';
 const original=await (await search.waitForFunction(selector=>{const element=document.querySelector(selector);return element&&getComputedStyle(element).backgroundColor||false;},selector)).jsonValue();
 await checkbox.check();await search.waitForFunction(selector=>document.querySelector(selector)?.hasAttribute('data-report-selected'),knowledge?'.knowledge-card':'.result');
 const appearance=await target.evaluate(element=>({background:getComputedStyle(element).backgroundColor,outline:getComputedStyle(element).outlineStyle,checked:element.querySelector('.report-checkbox').checked}));
 assert.equal(appearance.background,colorScheme==='dark'?'rgb(56, 40, 37)':'rgb(247, 232, 229)');assert.equal(appearance.checked,true);assert.equal(appearance.outline,'solid');
 const reason=search.locator('#report-reason');await reason.focus();await search.keyboard.press('Tab');await search.keyboard.press('Shift+Tab');
 const focus=await reason.evaluate(element=>{const label=element.parentElement.querySelector('span').getBoundingClientRect(),box=element.getBoundingClientRect(),css=getComputedStyle(element);return {visible:element.matches(':focus-visible'),clearance:box.top-parseFloat(css.outlineWidth)-parseFloat(css.outlineOffset)-label.bottom,outline:css.outlineStyle};});
 assert.equal(focus.visible,true);assert.equal(focus.outline,'solid');assert.ok(focus.clearance>=4,'Keyboard outline overlaps label: '+JSON.stringify(focus));
 if(category==='general'&&!knowledge&&width===320)await search.locator('#report-assistant').screenshot({path:new URL(`../../evidence/control-plane/${VERSION}-report-assistant-`+colorScheme+'.png',import.meta.url).pathname});
 await checkbox.uncheck();await search.waitForFunction(selector=>document.querySelector(selector)?.hasAttribute('data-report-selected')===false,knowledge?'.knowledge-card':'.result');
 assert.equal(await target.evaluate(element=>getComputedStyle(element).backgroundColor),original);
 await checkbox.check();await search.locator('#report-reason').selectOption('spam');await search.locator('#report-cancel').click();await search.locator('#report-discard').click();await search.locator('#report-assistant').waitFor({state:'detached'});
 assert.equal(await search.locator('[data-report-selected]').count(),0);assert.equal(await search.locator('.report-checkbox:checked').count(),0);
 return {category,colorScheme,width,knowledge,appearance,focus};
}
try{
 await admin.goto(base+'/admin');await admin.getByRole('button',{name:'Anmelden mit CCS Account',exact:true}).or(admin.getByRole('link',{name:'Anmelden mit CCS Account',exact:true})).click();
 await admin.getByRole('link',{name:'administrator',exact:true}).click();await admin.waitForFunction(()=>window.XTendPage?.getRuntime());
 await admin.evaluate(()=>window.XTendPage.visit('/admin?view=sources&engine=wikipedia'));await admin.locator('#policy-form').waitFor();
 const policy=admin.locator('#policy-form'),revision=await policy.locator('[name=revision]').inputValue();
 await policy.locator('[name=state]').selectOption('allowed');await policy.locator('[name=capabilities]').fill('knowledge');await policy.locator('[name=rpm]').fill('60');await policy.locator('[name=concurrency]').fill('4');await policy.locator('[name=family]').fill('wikimedia');await policy.locator('button[type=submit]').click();
 await admin.waitForFunction(revision=>document.querySelector('#policy-form [name=revision]')?.value!==revision,revision);
 await admin.setViewportSize({width:390,height:1000});await admin.waitForFunction(()=>document.getElementById('source-panel')?.getAttribute('mode')==='fullscreen');
 for(let i=0;i<3;i++)await admin.evaluate(i=>window.XTendPage.getRuntime().dispatchCommand('admin.connection.set',{message:'Mobile live '+i}),i);
 assert.equal(await admin.locator('#source-panel').getAttribute('mode'),'fullscreen');await admin.setViewportSize({width:1440,height:1000});await admin.waitForFunction(()=>document.getElementById('source-panel')?.getAttribute('mode')==='docked');
 checks.push('RMT-owned adaptive source panel stays fullscreen during mobile live renders and returns to docked on desktop.');
 await admin.getByRole('link',{name:'Wetter',exact:true}).click();await admin.locator('#weather-policy-form').waitFor();
 original={enabled:await admin.locator('[name=enabled]').isChecked(),paused:await admin.locator('[name=paused]').isChecked()};
 await saveWeather(false);await dismissAll();
 const before=await (await context.request.get('http://localhost:8094/weather-stats')).json();
 await tabs('/',false);await tabs('/search?q=Fixture&categories=weather',false);
 await search.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 assert.match(await search.locator('.empty-state[role=alert]').textContent(),/nicht freigegeben/);
 const after=await (await context.request.get('http://localhost:8094/weather-stats')).json();assert.deepEqual(after,before);
 checks.push('Unapproved Weather is absent in SSR and resumed home/deep-link tabs; direct links make zero provider calls.');
 await saveWeather(true);const toast=admin.locator('x-toast.admin-toast').last();await toast.waitFor();
 assert.equal(await toast.getAttribute('duration'),'6000');
 const id=await toast.getAttribute('id'),started=Date.now();
 await admin.evaluate(id=>{window.feedbackNode=document.getElementById(id);window.feedbackShows=0;document.addEventListener('toast-shown',()=>window.feedbackShows++);},id);
 for(let i=0;i<4;i++){
  await admin.waitForTimeout(900);
  await admin.evaluate(async i=>{const runtime=window.XTendPage.getRuntime();await runtime.dispatchCommand('admin.live.set',{value:{...runtime.model.getState('admin.live'),updated:'Fixture update '+i}});await runtime.dispatchCommand('admin.connection.set',{message:'Fixture live '+i});},i);
  assert.equal(await admin.evaluate(id=>document.getElementById(id)===window.feedbackNode,id),true);
  assert.equal(await toast.isVisible(),true);
 }
 assert.equal(await admin.evaluate(()=>window.feedbackShows),0,'live renders must not remount or reannounce a toast');
 await toast.waitFor({state:'detached',timeout:5000});const visibleMs=Date.now()-started;assert.ok(visibleMs>=5500&&visibleMs<9000);
 await admin.evaluate(()=>window.XTendPage.getRuntime().dispatchCommand('admin.connection.set',{message:'Fixture after expiry'}));assert.equal(await admin.locator('x-toast.admin-toast').count(),0);
 checks.push('Success XToast keeps the same DOM node through live renders, stays readable for six seconds and expires without resurrection.');
 await tabs('/',true);
 await saveWeather(true,true);await tabs('/',false);await tabs('/search?q=Fixture&categories=weather',false);
 await saveWeather(true,false);await tabs('/',true);await dismissAll();
 checks.push('Approval shows the tab; administrative pause hides it; resuming restores it.');
 await admin.route('**/admin.weather.policy.set',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({schema:'xtend.maraca.app-service-response.v1',ok:false,error:{code:'fixture',message:'Fixture: Änderung nicht gespeichert'}})}));
 await admin.locator('#weather-policy-form button[type=submit]').click();
 const error=admin.locator('x-toast.admin-toast[type=error]');await error.waitFor();assert.equal(await error.getAttribute('duration'),'0');
 await admin.waitForTimeout(6500);await admin.evaluate(()=>window.XTendPage.getRuntime().dispatchCommand('admin.connection.set',{message:'Fixture persistent error'}));assert.equal(await error.isVisible(),true);
 await error.getByRole('button',{name:'Schliessen',exact:true}).click();await error.waitFor({state:'detached'});await admin.unroute('**/admin.weather.policy.set');
 checks.push('Error XToast remains visible beyond six seconds and live updates, until explicitly dismissed.');
 await search.goto(base+'/search?q=filter-fixture&categories=news');await search.waitForFunction(()=>window.XTendPage?.getRuntime());await search.locator('#report-start').waitFor();
 const filters=[];for(const width of [320,390,700,1308,1920])filters.push(await filterGeometry(search,width));
 await search.goto(base+'/search?q=Fixture&categories=weather');await search.waitForFunction(()=>window.XTendPage?.getRuntime());filters.push(await filterGeometry(search,390));
 await search.emulateMedia({reducedMotion:'reduce'});await search.goto(base+'/');await search.waitForFunction(()=>window.XTendPage?.getRuntime());filters.push(await filterGeometry(search,390));
 const native=await browser.newContext({javaScriptEnabled:false,colorScheme:'dark'}),page=await native.newPage();
 try{await page.goto(base+'/search?q=filter-native-fixture&categories=news');for(const width of [320,1308])filters.push(await filterGeometry(page,width,'native'));}finally{await native.close();}
 checks.push('Filter portal retains its own readable width and three equal 44px action slots with at least 10px gaps at 320–1920px, with report button, weather/home layouts, Reduced Motion and native no-JS details.');
 const reports=[];for(const colorScheme of ['light','dark']){
  reports.push(await reportAppearance('general',colorScheme,320));
  reports.push(await reportAppearance('general',colorScheme,1440,true));
  for(const category of ['images','news','videos'])reports.push(await reportAppearance(category,colorScheme,390));
 }
 checks.push('Checked results and Knowledge cards have a pastel-red surface in both themes, including an open image preview; uncheck and discard clear it. Keyboard focus never covers the reason label at 320–1440px.');
 await saveWeather(original.enabled,original.paused);await dismissAll();assert.deepEqual(errors,[]);
 await fs.writeFile(new URL(`../../evidence/control-plane/${VERSION}-availability-feedback-browser.json`,import.meta.url),JSON.stringify({ok:true,checks,visibleMs,filters,reports,errors,scope:'Offline Docker fixtures, synthetic OAuth; no production policies or real providers'},null,2));
 console.log(JSON.stringify({ok:true,checks,visibleMs}));
}catch(error){await admin.screenshot({path:'/tmp/xtend060-availability-feedback-failure.png',fullPage:true}).catch(()=>{});console.error(error);process.exitCode=1;}
finally{await browser.close();}
