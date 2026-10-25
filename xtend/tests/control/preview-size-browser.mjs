import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {VERSION} from '../../shared/version.mjs';

const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch();
const out=new URL('../../evidence/control-plane/',import.meta.url),name=process.env.PREVIEW_SIZE_EVIDENCE_NAME||`${VERSION}-preview-size-browser`;
const geometry=[],errors=[],sizes=[[2400,300],[300,2400],[800,800]];
const context=await browser.newContext({viewport:{width:1122,height:892},colorScheme:'dark'}),page=await context.newPage();
const sources=new Map();let hold=null;
page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
const loaded=index=>page.waitForFunction(size=>{const image=document.querySelector('#preview-image');return image?.naturalWidth===size[0]&&image.naturalHeight===size[1]&&!window.XTendPage.getRuntime().model.getState('search.preview').imageLoading;},sizes[index%sizes.length]);
async function measure(width,phase,index){
 const shape=await page.locator('#image-preview').evaluate(aside=>{
  const box=e=>e?.getBoundingClientRect().toJSON(),image=aside.querySelector('#preview-image');
  return {surface:box(document.getElementById('search-preview-panel')||aside),aside:box(aside),toolbar:box(aside.querySelector('.preview-toolbar')),canvas:box(aside.querySelector('.preview-canvas')),controls:['#preview-close','[data-preview-action=previous]','[data-preview-action=next]','.preview-busy-slot'].map(s=>box(aside.querySelector(s))),image:image?{box:box(image),width:image.naturalWidth,height:image.naturalHeight}:null,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 geometry.push({width,phase,index,...shape});assert.equal(shape.overflow,false);
 assert(Math.abs(shape.aside.width-shape.surface.width)<1,'Sidebar chrome fills the allocated surface width');return shape;
}
function sameChrome(a,b){
 for(const [part,keys]of [['aside',['x','width']],['toolbar',['x','y','width','height']],['canvas',['x','y','width','height']]])
  for(const key of keys)assert(Math.abs(a[part][key]-b[part][key])<1,`${part}.${key} changed with image dimensions: ${a[part][key]} → ${b[part][key]}`);
 for(let i=0;i<a.controls.length;i++)for(const key of ['x','y','width','height'])
  assert(Math.abs(a.controls[i][key]-b.controls[i][key])<1,`Control ${i}.${key} moved with image dimensions`);
}
try{
 const health=await(await fetch(base+'/health/ready')).json();
 await page.route('**/media?*',async route=>{
  const index=sources.get(route.request().url());if(hold&&index===hold.index)await hold.promise;
  const [w,h]=sizes[index%sizes.length]||[800,500];
  await route.fulfill({status:200,contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#527b7d"/></svg>`});
 });
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());await page.locator('#search-input').fill('preview-size-fixture');await page.getByRole('link',{name:'Bilder',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete'&&document.querySelectorAll('[data-preview-id]').length>=3);
 const entries=await page.evaluate(()=>window.XTendPage.page.props['search.data'].results.map(r=>({preview:r.previewSrc,thumbnail:r.thumbnail})));
 for(let i=0;i<entries.length;i++)for(const src of [entries[i].preview,entries[i].thumbnail])if(src)sources.set(new URL(src,base).href,i);
 for(const width of [1122,320,390,768,960,961,1199,1200,1440,1920,3840]){
  await page.setViewportSize({width,height:892});await page.locator('[data-preview-id]').first().click();await loaded(0);
  await page.locator('#image-preview').evaluate(e=>Promise.all((e.closest('x-section')||e).getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  const first=await measure(width,'wide',0);
  assert.equal(first.image.width,2400);assert.equal(first.image.height,300);
  let release;hold={index:1,promise:new Promise(resolve=>release=resolve)};
  await page.locator('[data-preview-action=next]').click();await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.preview').imageLoading);
  sameChrome(first,await measure(width,'loading-portrait',1));release();hold=null;await loaded(1);
  const portrait=await measure(width,'portrait',1);assert.equal(portrait.image.height,2400);sameChrome(first,portrait);
  await page.locator('[data-preview-action=next]').click();await loaded(2);const square=await measure(width,'square',2);assert.equal(square.image.width,800);sameChrome(first,square);
  await page.locator('[data-preview-action=previous]').click();await loaded(1);sameChrome(first,await measure(width,'portrait-return',1));
  await page.locator('#preview-close').click();await page.waitForFunction(()=>!document.querySelector('#image-preview'));
 }
 if(process.env.PREVIEW_SIZE_BASELINE){
  const reference=JSON.parse(await fs.readFile(process.env.PREVIEW_SIZE_BASELINE,'utf8'));
  for(const current of geometry.filter(g=>g.phase==='wide')){
   const previous=reference.geometry.find(g=>g.width===current.width&&g.phase===current.phase);assert(previous);
   for(const part of ['aside','toolbar','canvas'])for(const key of ['x','width'])assert(Math.abs(current[part][key]-previous[part][key])<1,`0.7.5 ${part}.${key} differs at ${current.width}px`);
   assert(Math.abs(current.canvas.height-previous.canvas.height)<1,'Retain 0.7.5 media height');
  }
 }
 assert.deepEqual(errors,[]);
 const result={ok:true,version:health.version,checks:['Wide, portrait, square, pending image and reverse navigation keep the sidebar width, media viewport and all toolbar controls fixed at 320–3840px.','When supplied, actual 0.7.5 geometry is the dimensional reference; responsive split/stack and media height are preserved.'],geometry,errors,scope:'Actual Docker images, offline providers and synthetic images. No live searches or source URLs retained.'};
 await fs.writeFile(new URL(`${name}.json`,out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,version:health.version,samples:geometry.length}));
}catch(error){
 await fs.writeFile(new URL(`${name}.json`,out),JSON.stringify({ok:false,message:error.message,geometry,errors},null,2)+'\n');throw error;
}finally{hold=null;await browser.close();}
