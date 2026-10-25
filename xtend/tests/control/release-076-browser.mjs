import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {VERSION} from '../../shared/version.mjs';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch(),checks=[],geometry=[],errors=[];
const out=new URL('../../evidence/control-plane/',import.meta.url);
const context=await browser.newContext({viewport:{width:1122,height:892},colorScheme:'dark'}),page=await context.newPage();
page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>window.XTendPage?.getRuntime());
const complete=()=>page.waitForFunction(()=>!window.XTendPage.page.props['search.data'].stream||window.XTendPage.page.props['search.data'].stream.phase==='complete');
const settle=()=>page.locator('#search-filter-panel').evaluate(element=>Promise.all(element.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
async function filterShape(p,width,height,native=false){
 await p.setViewportSize({width,height});await p.goto(base+'/');if(!native)await ready();
 const before=await p.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth}));
 await p.locator('#filters>summary').click();await p.locator('#language').waitFor({state:'visible'});if(!native)await settle();
 const shape=await p.locator('.filter-panel').evaluate(panel=>{
  const r=panel.getBoundingClientRect(),form=document.querySelector('#search-form').getBoundingClientRect(),fields=[...panel.querySelectorAll('select')].map(e=>e.getBoundingClientRect().toJSON()),buttons=[...panel.querySelectorAll('.filter-actions>button')].map(e=>e.getBoundingClientRect().toJSON());
  return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,formCenter:form.x+form.width/2,fields,buttons,viewport:{w:innerWidth,h:innerHeight},pageHeight:document.documentElement.scrollHeight,pageWidth:document.documentElement.scrollWidth};
 });
 assert(shape.x>=15&&shape.x+shape.w<=width-15,JSON.stringify(shape));
 assert(shape.y>=0&&shape.bottom<=height+1,JSON.stringify(shape));
 assert(shape.pageHeight<=Math.max(before.height,height)+1,'Filter must not add document scrolling: '+JSON.stringify(shape));
 assert(shape.pageWidth<=width+1);assert(shape.buttons.every(b=>b.height>=44));
 if(width>600){assert(shape.buttons[0].x>shape.fields[0].x+shape.fields[0].width);if(height>760)assert(Math.abs(shape.x+shape.w/2-shape.formCenter)<1);}
 else assert(Math.abs(shape.buttons[0].x-shape.fields[0].x)<1);
 geometry.push({width,height,native,...shape});
 if((width===1122&&!native)||(width===390&&!native))await p.screenshot({path:new URL(`${VERSION}-filters-${width}.png`,out).pathname});
 await p.locator('#filters>summary').click();await p.locator('#language').waitFor({state:'hidden'});
}
try{
 for(const [w,h]of [[320,568],[390,844],[600,600],[700,650],[1122,892],[1440,900],[1920,1080],[3840,2160]])await filterShape(page,w,h);
 const native=await browser.newContext({javaScriptEnabled:false,colorScheme:'dark'}),np=await native.newPage();
 try{for(const [w,h]of [[320,568],[1122,892]])await filterShape(np,w,h,true);}finally{await native.close();}
 checks.push('Centered two-column filter panel, mobile/low-height internal scrolling, no added document overflow, 44px actions and no-JS controls at 320–3840px.');
 await page.setViewportSize({width:1122,height:892});await page.goto(base+'/');await ready();
 for(let i=0;i<8;i++)await page.locator('#filters>summary').click({delay:5});
 await page.waitForFunction(()=>!window.XTendPage.getRuntime().model.getState('search.filterUi').open&&!document.querySelector('#filters').open);
 assert.equal(await page.locator('#language').isVisible(),false);
 checks.push('Rapid filter toggles settle closed with no invisible focusable controls.');
 const image='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><rect width="800" height="500" fill="#294e59"/><circle cx="610" cy="120" r="55" fill="#d6bea0"/><path d="M0 500 220 140 440 500M260 500 560 210 800 500" fill="#527b7d"/></svg>';
 await page.route('**/media?*',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:image}));
 await page.addInitScript(()=>{window.mediaAnimations=[];window.addEventListener('xtend-rmt:animation-start',e=>window.mediaAnimations.push(e.detail));});
 await page.goto(base+'/search?q=motion-fixture&categories=images');await ready();
 const first=page.locator('[data-preview-id]').first();await first.waitFor();await first.click();
 await page.locator('#preview-image').waitFor();await page.waitForFunction(()=>document.getElementById('preview-image')?.naturalWidth>0);
 await page.waitForFunction(()=>window.mediaAnimations.some(e=>e.transition==='search.preview.open'&&e.phase==='enter'));
 await page.locator('#search-preview-panel').evaluate(e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{}))));
 await page.screenshot({path:new URL(`${VERSION}-preview-open.png`,out).pathname});
 await page.locator('#preview-expand').click();await page.getByRole('dialog',{name:'Bildansicht',exact:true}).waitFor();
 const morph=await page.locator('#lightbox-image').evaluate(image=>image.getAnimations().map(a=>({frames:a.effect.getKeyframes(),timing:a.effect.getComputedTiming()})));
 assert(morph.some(a=>a.frames[0]?.transform.includes('scale(')),'Full-screen image must morph from the actual sidebar content box');
 await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.lightbox-position')?.textContent.startsWith('Bild 2 von '));
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('search-lightbox'));
 assert.equal(await page.locator('#image-preview').isVisible(),true);
 await page.locator('#preview-close').click();await page.waitForFunction(()=>!document.getElementById('image-preview'));
 assert(await page.evaluate(()=>window.mediaAnimations.some(e=>e.transition==='search.preview.close'&&e.phase==='exit')));
 await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-preview-id'));
 assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-preview-id')),true);
 // Latest intent survives close/reopen and navigation, including motion off.
 for(let i=0;i<3;i++){await first.click();await page.locator('#preview-close').click();}
 await first.click();await page.waitForFunction(()=>document.querySelector('#preview-image')?.naturalWidth>0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#preview-expand').click();await page.getByRole('dialog',{name:'Bildansicht',exact:true}).waitFor();
 assert.equal(await page.locator('#lightbox-image').evaluate(e=>e.getAnimations().length),0);
 await page.keyboard.press('Escape');await page.locator('#preview-close').click();await page.waitForFunction(()=>!document.getElementById('image-preview'));
 await first.click();await page.getByRole('link',{name:'Web',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='general');
 assert.equal(await page.locator('#image-preview').count(),0);assert.equal(await page.locator('#search-lightbox').count(),0);
 checks.push('RMT sidebar enter/exit, real image-content FLIP through the XTend runner, carousel/focus return, rapid actions, Reduced Motion and stale-navigation cleanup.');
 await complete();await page.locator('#search-input').fill('unsent draft fixture');await page.locator('#search-wordmark').click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].view==='home');assert.equal(await page.locator('#search-input').inputValue(),'');
 await page.locator('#search-input').fill('clear fixture');await page.locator('#search-input').press('Escape'); // Native search inputs retain their built-in clear action.
 assert.equal(await page.locator('#search-input').getAttribute('type'),'search');
 await page.locator('#search-input').fill('search again fixture');await page.locator('.search-button').click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='partial');
 await page.locator('#search-input').fill('next unsent fixture');await complete();
 assert.equal(await page.locator('#search-input').inputValue(),'next unsent fixture');
 checks.push('Logo navigation clears both submitted text and unsent drafts; the native search clear affordance and subsequent searches remain functional.');
 assert.deepEqual(errors,[]);
 await fs.writeFile(new URL(`${VERSION}-shell-motion-browser.json`,out),JSON.stringify({ok:true,checks,geometry,morph,errors,scope:'Isolated Docker fixtures and synthetic local images; no real providers or user data'},null,2)+'\n');
 console.log(JSON.stringify({ok:true,checks}));
}catch(error){console.error(await page.evaluate(()=>({previewOpen:window.XTendPage?.getRuntime()?.model.getState('search.preview')?.open,query:window.XTendPage?.getRuntime()?.model.getState('search.query'),panel:document.querySelector('#search-preview-panel')?.outerHTML.slice(0,400),active:document.activeElement?.id})).catch(()=>null));await page.screenshot({path:'/tmp/xtend076-browser-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
