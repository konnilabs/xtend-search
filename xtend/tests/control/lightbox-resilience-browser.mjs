import {VERSION} from '../../shared/version.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch(),checks=[],geometry=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'}),page=await context.newPage(),errors=[],requests=new Map();let recovered=false;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('**/media?*',async route=>{
  const url=new URL(route.request().url()),image=Buffer.from(url.searchParams.get('u')||'','base64url').toString();requests.set(image,(requests.get(image)||0)+1);
  if(image.includes('thumb-0')||image.includes('thumb-1')||image.includes('/1.png')&&!recovered)return route.fulfill({status:404,headers:{'Cache-Control':'no-store'},body:''});
  return route.fulfill({status:200,contentType:'image/png',headers:{'Cache-Control':'private, max-age=300'},body:png});
 });
 await page.route('**/api/xtend/services/search.run',async route=>{
  const response=await route.fetch(),frames=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  for(const frame of frames){const data=frame.value?.data??frame.delta?.data;if(data?.category==='images'&&data.results?.length){const rows=data.results;data.results=Array.from({length:100},(_,index)=>({...rows[index%rows.length],id:'gallery-'+index,previewId:'gallery-'+index}));data.countLabel='100 Ergebnisse';}}
  await route.fulfill({response,body:frames.map(frame=>JSON.stringify(frame)).join('\n')+'\n'});
 });
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());await page.locator('#search-input').fill('gallery fixture');await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete'&&document.querySelectorAll('.image-results article').length===100);
 await page.waitForFunction(()=>{const images=document.querySelectorAll('.image-results article img');return images[0]?.naturalWidth>0&&images[0].getAttribute('src').includes('/media?')&&images[1]?.getAttribute('src').includes('image-placeholder');});
 assert.equal(await page.locator('.image-results article').first().locator('[data-unavailable]').count(),0);
 const settled=JSON.stringify([...requests]);await page.waitForTimeout(300);assert.equal(JSON.stringify([...requests]),settled,'No automatic retry loop after failed sources settle');checks.push('Broken thumbnail falls back to the signed original; two broken sources settle on a placeholder without a retry loop.');
 recovered=true;await page.locator('[data-preview-id]').nth(1).click();await page.waitForFunction(()=>document.querySelector('#preview-image')?.naturalWidth>0&&document.querySelectorAll('.image-results article img')[1]?.naturalWidth>0&&!document.querySelectorAll('.image-results article img')[1].getAttribute('src').includes('image-placeholder'));checks.push('A successful side preview repairs the failed grid image through the RMT projection.');
 for(const width of [320,390,768,1440,1920,3840]){
  await page.setViewportSize({width,height:900});await page.locator('#preview-expand').click();await page.getByRole('dialog',{name:'Bildansicht',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('#lightbox-image')?.naturalWidth>0);
  const shape=await page.locator('#search-lightbox').evaluate(host=>{const dialog=host.shadowRoot.querySelector('dialog'),box=dialog.getBoundingClientRect(),image=host.querySelector('#lightbox-image').getBoundingClientRect();return {tag:host.localName,width:box.width,height:box.height,x:box.x,y:box.y,viewport:[innerWidth,innerHeight],imageHeight:image.height,scrollHeight:document.documentElement.scrollHeight};});
  assert.equal(shape.tag,'x-search-lightbox');assert.equal(shape.x,0);assert.equal(shape.y,0);assert.equal(shape.width,width);assert.equal(shape.height,900);assert(shape.imageHeight>400,'Image uses the viewport media area');assert.equal(await page.locator('x-dialog#search-lightbox').count(),0);
  if(width===1440)await page.screenshot({path:'/tmp/xtend073-native-lightbox.png'});
  assert.match(await page.locator('.lightbox-source').getAttribute('href'),/^https:/);assert.match(await page.locator('.lightbox-original').getAttribute('href'),/^https:/);assert.equal(await page.locator('.lightbox-original').getAttribute('rel'),'noreferrer noopener');
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>{const host=document.getElementById('search-lightbox');return document.activeElement===host||host.contains(document.activeElement);}),'Focus stays in the full-screen lightbox');}
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('.lightbox-position')?.textContent==='Bild 3 von 100');await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('.lightbox-position')?.textContent==='Bild 2 von 100');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#search-lightbox'));assert.equal(await page.evaluate(()=>document.activeElement?.id),'preview-expand');geometry.push(shape);
 }
 checks.push('Viewport-sized XSearchLightbox, original/source links, focus containment, keyboard carousel and return focus at 320–3840px.');
 await page.locator('#preview-expand').click();await page.getByRole('dialog',{name:'Bildansicht',exact:true}).waitFor();await page.locator('.lightbox-close').click();await page.waitForFunction(()=>!document.querySelector('#search-lightbox'));
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#preview-expand').click();await page.getByRole('dialog',{name:'Bildansicht',exact:true}).waitFor();assert.equal(await page.locator('#search-lightbox').evaluate(host=>host.shadowRoot.querySelector('dialog').getAnimations().length),0);
 await page.evaluate(()=>window.XTendPage.visit('/'));await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].view==='home'&&!document.querySelector('#search-lightbox'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);checks.push('Close button, Reduced Motion and navigation dispose the overlay without leaving an inert page.');
 assert.deepEqual(errors,[]);const result={ok:true,checks,geometry,scope:'Offline image and provider fixtures; 100 gallery items. No live queries or image URLs retained.'};await fs.writeFile(new URL(`../../evidence/control-plane/${VERSION}-lightbox-resilience-browser.json`,import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){await page.screenshot({path:new URL(`../../evidence/control-plane/${VERSION}-lightbox-failure.png`,import.meta.url).pathname}).catch(()=>{});console.error(await page.locator('#search-lightbox').evaluate(host=>({host:host.getBoundingClientRect().toJSON(),dialog:host.shadowRoot.querySelector('dialog').getBoundingClientRect().toJSON(),content:host.shadowRoot.querySelector('.content').getBoundingClientRect().toJSON(),image:host.querySelector('img').getBoundingClientRect().toJSON()})).catch(()=>null));throw error;}finally{await browser.close();}
