import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {VERSION} from '../../shared/version.mjs';

const base=process.env.TEST_BASE_URL||'http://localhost:8093',browser=await chromium.launch();
const out=new URL('../../evidence/control-plane/',import.meta.url),name=process.env.IMAGE_GRID_EVIDENCE_NAME||`${VERSION}-image-grid-browser`;
const geometry=[],errors=[],widths=[1122,320,390,960,961,1199,1200,1440,1920,3840];
const image='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#294e59"/></svg>';
let page;
async function shape(phase,native=false){
 const value=await page.locator('#results').evaluate(results=>{
  const layout=results.querySelector('.result-layout'),main=layout.querySelector('.result-main'),grid=layout.querySelector('.image-results'),preview=layout.querySelector('#search-preview-panel');
  const box=e=>e?.getBoundingClientRect().toJSON();
  return {width:innerWidth,layout:box(layout),main:box(main),grid:box(grid),preview:box(preview),columns:getComputedStyle(layout).gridTemplateColumns,hasCards:results.hasAttribute('data-has-cards'),previewOpen:results.getAttribute('data-preview-open'),pageWidth:document.documentElement.scrollWidth};
 });
 geometry.push({phase,native,...value});assert(value.pageWidth<=value.width+1,'No horizontal document overflow');
 return value;
}
async function fullWidth(phase,native=false){
 const value=await shape(phase,native);
 assert(Math.abs(value.main.width-value.layout.width)<1,`Closed preview must release the entire result width: ${JSON.stringify(value)}`);
 assert(Math.abs(value.grid.width-value.layout.width)<1,'Image grid fills the result layout');
 assert.equal(value.columns.trim().split(/\s+/).length,1,'No reserved sidebar column while closed');
}
try{
 const native=await browser.newContext({javaScriptEnabled:false,colorScheme:'dark',viewport:{width:1122,height:892}});
 page=await native.newPage();await page.goto(base+'/search?q=grid-layout-fixture&categories=images');await page.locator('.image-results article').first().waitFor();
 for(const width of widths){await page.setViewportSize({width,height:892});await fullWidth('ssr.closed',true);}
 await native.close();

 const context=await browser.newContext({colorScheme:'dark',viewport:{width:1122,height:892}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/media?*',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:image}));
 await page.goto(base+'/');await page.waitForFunction(()=>window.XTendPage?.getRuntime());await page.locator('#search-input').fill('grid-layout-fixture');await page.getByRole('link',{name:'Bilder',exact:true}).click();
 await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete'&&document.querySelector('.image-results article'));
 for(const width of widths){
  await page.setViewportSize({width,height:892});await fullWidth('resumed.closed.initial');
  if(width===1122)await page.screenshot({path:new URL(`${name}-closed.png`,out).pathname});
  await page.locator('[data-preview-id]').first().click();await page.locator('#preview-image').waitFor();
  await page.locator('#search-preview-panel').evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
  const open=await shape('resumed.open');
  if(width>960){assert(open.main.width<open.layout.width*.65,'Desktop preview shares the result width');assert(open.preview.x>=open.main.right,'Sidebar occupies the second column');}
  else assert(Math.abs(open.main.width-open.layout.width)<1,'Mobile preview stacks above the full-width grid');
  await page.locator('#preview-close').click();await page.waitForFunction(()=>!document.getElementById('image-preview'));await fullWidth('resumed.closed.after');
 }
 await page.getByRole('link',{name:'Web',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 await page.getByRole('link',{name:'Bilder',exact:true}).click();await page.waitForFunction(()=>window.XTendPage.page.props['search.data'].category==='images'&&window.XTendPage.page.props['search.data'].stream?.phase==='complete');
 await fullWidth('resumed.cached.closed');assert.deepEqual(errors,[]);
 const result={ok:true,checks:['SSR/no-JS and streamed/resumed grids use the full result width while closed at 320–3840px, including both sides of the 960px and 1200px breakpoints.','Opening retains desktop split/mobile stack; closing and cached mode return release the sidebar column.'],geometry,errors,scope:'Offline Docker providers and synthetic local images; no live queries or provider URLs retained.'};
 await fs.writeFile(new URL(`${name}.json`,out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,checks:result.checks,samples:geometry.length}));
}catch(error){
 await fs.writeFile(new URL(`${name}.json`,out),JSON.stringify({ok:false,message:error.message,geometry,errors},null,2)+'\n');throw error;
}finally{await browser.close();}
