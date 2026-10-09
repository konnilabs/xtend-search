import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
const version=JSON.parse(await fs.readFile(new URL('../../package.json',import.meta.url))).version;
const out=new URL('../../evidence/control-plane/',import.meta.url),checks=[],errors=[];
const browser=await chromium.launch();
async function landing(page){
 assert.equal(await page.locator('#search-form').count(),1);
 const text=await page.locator('body').innerText();
 for(const old of ['DEIN FENSTER INS WEB','Mehr Perspektiven. Weniger Ablenkung.','Keine Analyse-Tracker'])assert.ok(!text.includes(old));
 const form=await page.locator('#search-form').boundingBox(),hero=await page.locator('.hero').boundingBox();
 const wordmark=await page.locator('#search-wordmark').boundingBox();
 const width=await page.evaluate(()=>innerWidth);
 assert.equal(await page.locator('.topbar .wordmark').count(),1);
 assert.equal(await page.locator('.hero-wordmark').count(),0,'no duplicate central wordmark');
 assert.equal(await page.getByRole('heading',{name:'XTend.search',level:1}).count(),1);
 assert.ok(Math.abs(wordmark.x+wordmark.width/2-width/2)<1,'single wordmark is centered');
 assert.ok(wordmark.y>90,'no small wordmark in the top-left corner');
 assert.ok(hero.y>=wordmark.y+wordmark.height-1,'tagline follows wordmark');
 assert.equal(await page.locator('#search-logo').evaluate(e=>getComputedStyle(e).display),'none');
 assert.ok(Math.abs(form.x+form.width/2-width/2)<1,'landing form is centered');
 assert.ok(form.y>=hero.y+hero.height-1,'form follows logo/tagline');
 assert.equal(await page.locator('.header-backdrop').evaluate(e=>getComputedStyle(e).display),'none');
 const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,shell:document.querySelector('#search-shell').getBoundingClientRect().height,footer:document.querySelector('.site-footer').getBoundingClientRect().bottom}));
 assert.ok(geometry.scrollWidth<=geometry.width+1);
 assert.ok(geometry.shell>=geometry.height-1,'shell fills viewport');
 assert.ok(geometry.footer>=geometry.height-1,'footer reaches viewport bottom');
}
try{
 const context=await browser.newContext({viewport:{width:1920,height:959},colorScheme:'dark'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.searchAnimations=[];const original=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   if(['search-form','search-wordmark','search-logo'].includes(this.id)||this.classList.contains('header-backdrop'))window.searchAnimations.push({target:this.id||'header-backdrop',frames,options});
   return original.call(this,frames,options);
  };
 });
 await page.goto(base+'/?language=all&time_range=&safesearch=1');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 for(const scheme of ['dark','light']){
  await page.emulateMedia({colorScheme:scheme});
  for(const width of [320,390,768,1280,1920,3840]){
   await page.setViewportSize({width,height:959});await landing(page);
   if([390,1920].includes(width))await page.screenshot({path:new URL(version+'-home-'+scheme+'-'+width+'.png',out).pathname});
  }
 }
 checks.push('Only one centered wordmark and no logo on the classic landing page; heading semantics, light/dark, 320–3840px, full viewport and footer tested.');
 await page.setViewportSize({width:1920,height:959});await page.emulateMedia({colorScheme:'dark'});
 const origin=await page.evaluate(()=>{window.originalInput=document.querySelector('#search-input');window.originalWordmark=document.querySelector('#search-wordmark');return performance.timeOrigin;});
 await page.locator('#search-input').fill('home morph');await page.getByRole('button',{name:'Suchen',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 assert.ok(await page.evaluate(()=>window.originalInput===document.querySelector('#search-input')));
 assert.ok(await page.evaluate(()=>window.originalWordmark===document.querySelector('#search-wordmark')));
 assert.equal(await page.getByRole('heading',{name:'XTend.search',level:1}).count(),0);
 assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
 const animations=await page.evaluate(()=>window.searchAnimations);
 assert.equal(animations.filter(a=>a.target==='search-form').length,1);
 assert.equal(animations.filter(a=>a.target==='header-backdrop').length,1);
 assert.equal(animations.filter(a=>a.target==='search-wordmark').length,1);
 assert.equal(animations.filter(a=>a.target==='search-logo').length,1);
 assert.match(animations.find(a=>a.target==='search-form').frames[0].transform,/translate\(.+\) scale\(.+\)/);
 assert.match(animations.find(a=>a.target==='search-wordmark').frames[0].transform,/translate\(.+\) scale\(.+\)/);
 assert.deepEqual(animations.find(a=>a.target==='search-logo').frames,animations.find(a=>a.target==='header-backdrop').frames);
 await page.waitForFunction(()=>document.querySelector('#search-form').getAnimations().length===0);
 const resultForm=await page.locator('#search-form').boundingBox();assert.ok(resultForm.y<80);
 const resultWordmark=await page.locator('#search-wordmark').boundingBox();assert.ok(resultWordmark.x<200&&resultWordmark.y<80);
 assert.notEqual(await page.locator('#search-logo').evaluate(e=>getComputedStyle(e).display),'none');
 await page.screenshot({path:new URL(version+'-results-header.png',out).pathname});
 await page.goBack();await page.waitForFunction(()=>document.querySelector('#search-shell').dataset.view==='home');
 await page.waitForFunction(()=>document.querySelector('#search-form').getAnimations().length===0);await landing(page);
 assert.ok(await page.evaluate(()=>window.originalWordmark===document.querySelector('#search-wordmark')));
 await page.goForward();await page.waitForFunction(()=>document.querySelector('#search-shell').dataset.view==='results');
 await page.waitForFunction(()=>document.querySelector('#search-form').getAnimations().length===0);
 assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
 checks.push('Persisted wordmark and input morph through real XUtils layout-flip; logo and background fade together, batches do not replay motion, history and animation cleanup work without reload.');
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 await page.locator('#search-input').fill('reduced motion');await page.getByRole('button',{name:'Suchen',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 assert.equal(await page.evaluate(()=>window.searchAnimations.length),0);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 await page.evaluate(()=>{Element.prototype.animate=undefined;Element.prototype.getAnimations=undefined;});
 await page.locator('#search-input').fill('motion unavailable');await page.getByRole('button',{name:'Suchen',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 assert.ok((await page.locator('#search-form').boundingBox()).y<80);
 const native=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:959},colorScheme:'light'}),np=await native.newPage();
 await np.goto(base+'/');await landing(np);await np.locator('#search-input').fill('native landing');await np.getByRole('button',{name:'Suchen',exact:true}).click();
 assert.equal(await np.locator('article.result').count(),10);assert.ok((await np.locator('#search-form').boundingBox()).y<140);
 await native.close();checks.push('Reduced motion and unavailable Web Animations use immediate layout; no-JS landing and native result-header search remain usable.');
 assert.deepEqual(errors,[]);
 await fs.writeFile(new URL(version+'-home-browser.json',out),JSON.stringify({ok:true,checks,errors,animations},null,2)+'\n');console.log(JSON.stringify({ok:true,checks}));
 await context.close();
}finally{await browser.close();}
