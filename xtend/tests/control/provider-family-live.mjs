// Explicit bounded smoke run against already approved LOCAL sources. Does not
// modify policies, retry failures, weaken filters or load result thumbnails.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
const page=await context.newPage(),report={time:new Date().toISOString(),modes:[]};
try{
 await page.goto('http://localhost:8090/search?q=ubuntu+lts&categories=general&language=all&safesearch=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.XTendPage));const origin=await page.evaluate(()=>performance.timeOrigin);
 for(const [id,label]of [['general','Web'],['images','Bilder'],['videos','Videos'],['news','Nachrichten']]){
  if(id!=='general'){
   await page.getByRole('link',{name:label,exact:true}).click();
   await page.waitForFunction(id=>window.XTendPage.page.props['search.data'].state?.category===id&&window.XTendPage.page.props['search.data'].stream?.phase==='complete',id,{timeout:25000});
  }
  report.modes.push(await page.evaluate(()=>{const d=window.XTendPage.page.props['search.data'];return {category:d.state.category,results:d.results.length,error:d.error,message:d.errorMessage,status:d.statusLabel,safeSearch:d.state.safeSearch,documentOrigin:performance.timeOrigin};}));
 }
 report.sameDocument=report.modes.every(m=>m.documentOrigin===origin);
 await fs.writeFile(new URL('../../evidence/control-plane/provider-family-live.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
