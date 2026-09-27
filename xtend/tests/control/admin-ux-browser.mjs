import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const out=new URL('../../evidence/control-plane/',import.meta.url),checks=[];
const browser=await chromium.launch();let page;
async function login(javaScriptEnabled=true){
 const context=await browser.newContext({javaScriptEnabled,viewport:{width:1440,height:1000},colorScheme:'dark'});
 const p=await context.newPage();await p.goto(base+'/admin');await p.getByRole('link',{name:'Mit Nextcloud anmelden'}).click();await p.getByRole('link',{name:'administrator',exact:true}).click();
 await p.getByRole('heading',{name:'Deine Quellen. Unter Kontrolle.'}).waitFor();
 if(javaScriptEnabled)await p.waitForFunction(()=>window.XTendPage?.getRuntime());
 return {context,page:p};
}
async function count(n){await page.waitForFunction(n=>document.querySelectorAll('.engine-choice').length===n,n);await page.waitForFunction(()=>window.XTendPage.page.url===location.pathname+location.search);}
async function contained(p){
 const bad=await p.locator('.engine-choice').evaluateAll(nodes=>nodes.flatMap(node=>{
  const box=node.getBoundingClientRect();return [...node.children].filter(child=>{const r=child.getBoundingClientRect();return r.left<box.left||r.right>box.right+1||r.top<box.top||r.bottom>box.bottom+1;}).map(()=>node.textContent);
 }));assert.deepEqual(bad,[],'Card text must remain inside its own border');
}
try{
 const admin=await login();page=admin.page;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await count(30);const timeOrigin=await page.evaluate(()=>performance.timeOrigin);
 await contained(page);
 const summary=page.locator('#capability-help summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#capability-help').getAttribute('open'),'');
 assert.match(await page.locator('#capability-help').textContent(),/general,images/);assert.equal(await page.locator('.capability-glossary code').count(),10);await page.keyboard.press('Enter');
 checks.push('Capability help opens from the keyboard, explains catalog vs. approval and provides all IDs plus a concrete example.');
 const target=page.locator('.engine-choice').filter({hasText:'fixture ux 12'});
 await target.scrollIntoViewIfNeeded();const position=await page.evaluate(()=>({window:scrollY,list:document.querySelector('.engine-list').scrollTop}));assert.ok(position.window>200);assert.ok(position.list>200);
 await target.click();await page.waitForFunction(()=>document.querySelector('.engine-detail h3').textContent.startsWith('fixture ux 12'));
 const after=await page.evaluate(()=>({window:scrollY,list:document.querySelector('.engine-list').scrollTop}));assert.ok(Math.abs(after.window-position.window)<2,JSON.stringify({position,after}));assert.ok(Math.abs(after.list-position.list)<2,JSON.stringify({position,after}));
 assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin);await contained(page);
 checks.push('Large source list and long names do not clip; selecting a deep entry preserves document and list scroll without reload.');
 const category=page.locator('#pool-filters select[name=category]');await category.selectOption('images');await count(13);
 assert.match(page.url(),/category=images/);assert.ok((await page.locator('.engine-choice span').allTextContents()).every(t=>t.includes('Bilder')));
 await page.locator('#pool-filters input[name=filterQuery]').fill('UX 1');await page.getByRole('button',{name:'Filtern',exact:true}).click();await count(5);
 await page.locator('.engine-choice').filter({hasText:'fixture ux 14'}).click();await page.waitForFunction(()=>document.querySelector('.engine-detail h3').textContent.includes('ux 14'));
 assert.equal(await category.inputValue(),'images');assert.equal(await page.locator('#pool-filters input[name=filterQuery]').inputValue(),'UX 1');await page.waitForURL(/filterQuery=UX\+1/);
 const revision=await page.locator('#policy-form input[name=revision]').inputValue();await page.locator('#policy-form input[name=rpm]').fill('7');await page.locator('#policy-form input[name=family]').fill('fixture-ux');await page.getByRole('button',{name:'Policy verbindlich speichern',exact:true}).click();
 await page.waitForFunction(revision=>document.querySelector('#policy-form input[name=revision]').value!==revision,revision);
 await count(5);assert.equal(await category.inputValue(),'images');assert.equal(await page.locator('#policy-form select[name=state]').inputValue(),'disabled');
 await page.getByRole('button',{name:'Stand aktualisieren',exact:true}).click();await count(5);assert.equal(await category.inputValue(),'images');
 checks.push('Category and case-insensitive name filters compose, survive source selection, policy save and refresh; no source was approved by this test.');
 await page.locator('#pool-filters input[name=filterQuery]').fill('does not exist');await page.getByRole('button',{name:'Filtern',exact:true}).click();await count(0);assert.ok(await page.locator('.pool-empty').isVisible());assert.ok(!(await page.locator('.engine-detail').isVisible()));
 await page.getByRole('link',{name:'Zurücksetzen',exact:true}).click();await count(30);
 await page.goBack();await count(0);assert.equal(await category.inputValue(),'images');assert.equal(await page.locator('#pool-filters input[name=filterQuery]').inputValue(),'does not exist');await page.goForward();await count(30);
 await category.selectOption('social media');await count(12);assert.ok((await page.locator('.engine-choice span').allTextContents()).every(t=>t.includes('Soziale Medien')));
 await category.selectOption('it');await count(12);assert.ok((await page.locator('.engine-choice span').allTextContents()).every(t=>t.includes('IT')));
 checks.push('Empty results provide recovery instead of an unrelated policy; reset, back/forward, IT and social-media filters work.');
 await page.getByRole('link',{name:'Zurücksetzen',exact:true}).click();await count(30);
 await page.locator('#pool').scrollIntoViewIfNeeded();await page.evaluate(()=>scrollTo(0,document.querySelector('#pool').getBoundingClientRect().top+scrollY-24));
 await page.screenshot({path:new URL('admin-ux-desktop.png',out).pathname});
 for(const width of [320,390,720]){
  await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Horizontal overflow at ${width}`);await contained(page);
  assert.ok(await page.locator('#pool').evaluate((e,width)=>e.getBoundingClientRect().width>=width-60,width),'Mobile controls must use the available width');
  assert.ok(parseFloat(await page.locator('#pool-filters input[name=filterQuery]').evaluate(e=>getComputedStyle(e).fontSize))>=16);
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#pool').scrollIntoViewIfNeeded();await page.screenshot({path:new URL('admin-ux-mobile.png',out).pathname});
 await page.emulateMedia({colorScheme:'light'});await summary.click();assert.ok(await page.locator('.capability-glossary').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('admin-ux-help-mobile.png',out).pathname});
 checks.push('320/390/720px layouts and light/dark help stay within viewport; search input retains at least 16px.');
 assert.deepEqual(errors,[]);await admin.context.close();
 const nojs=await login(false),np=nojs.page;await np.locator('#capability-help summary').click();assert.ok(await np.locator('.capability-glossary').isVisible());
 await np.locator('#pool-filters select[name=category]').selectOption('images');await np.getByRole('button',{name:'Filtern',exact:true}).click();assert.equal(await np.locator('.engine-choice').count(),13);
 await np.locator('#pool-filters input[name=filterQuery]').fill('ux 12');await np.getByRole('button',{name:'Filtern',exact:true}).click();assert.equal(await np.locator('.engine-choice').count(),1);await np.locator('.engine-choice').click();assert.match(await np.locator('.engine-detail h3').textContent(),/ux 12/);assert.equal(await np.locator('#pool-filters select[name=category]').inputValue(),'images');
 assert.equal(await np.locator('#policy-form').getAttribute('method'),'post');await np.getByRole('button',{name:'Abmelden',exact:true}).click();assert.ok(await np.getByRole('link',{name:'Mit Nextcloud anmelden'}).isVisible());await nojs.context.close();
 checks.push('Help, composed filters and source selection work with JavaScript disabled; safe POST forms and native logout remain intact.');
 const result={ok:true,checks,scroll:{before:position,after},fixtureSources:30};await fs.writeFile(new URL('admin-ux-browser.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){console.error(await page?.evaluate(()=>({url:location.href,filters:window.XTendPage?.getRuntime().model.getState('admin.data').filters,options:[...document.querySelectorAll('#pool-filters select option')].map(o=>({value:o.value,selected:o.selected,attribute:o.getAttribute('selected')}))})).catch(()=>null));await page?.screenshot({path:new URL('admin-ux-failure.png',out).pathname,fullPage:true}).catch(()=>{});console.error(error);process.exitCode=1;}finally{await browser.close();}
