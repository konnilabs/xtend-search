import {chromium,firefox} from 'playwright';
import assert from 'node:assert/strict';
import {resultProjection} from '../../frontend/result-projection-core.mjs';
const browser=await(process.env.TEST_BROWSER==='firefox'?firefox:chromium).launch(),context=await browser.newContext(),page=await context.newPage();let streams=0;
const base=process.env.TEST_BASE_URL||'http://localhost:8093';
try{
 page.on('request',request=>{if(request.url().endsWith('/search.run'))streams++;});
 await page.goto(base+'/search?q=cache+stale+projection&categories=general&language=all&time_range=&safesearch=1');
 await page.waitForFunction(()=>window.XTendSearchCacheStats?.().entries===1);
 await page.getByRole('link',{name:'Bilder',exact:true}).click();
 await page.waitForFunction(()=>{const d=window.XTendPage.getRuntime().model.getState('search.data');return(d.state?.category??d.category)==='images'&&d.stream?.phase==='complete'&&d.results?.length===4;});
 const images=await page.evaluate(()=>window.XTendPage.getRuntime().model.getState('search.data'));
 const old=resultProjection(images,images.results.map(row=>({...row,faviconSrc:'blob:stale-images',faviconReady:true})));
 await page.getByRole('link',{name:'Web',exact:true}).click();
 await page.waitForFunction(()=>{const p=window.XTendPage.page.props['search.data'],m=window.XTendPage.getRuntime().model.getState('search.data');return p.state?.category==='general'&&p.results.length===10&&(m.state?.category??m.category)==='general'&&m.results?.length===10&&document.querySelectorAll('article.result').length===10;});
 const before=await page.evaluate(()=>window.XTendPage.getRuntime().model.getState('search.data').results.map(row=>row.id));
 const result=await page.evaluate(value=>window.XTendPage.getRuntime().dispatchCommand('search.images.set',{value}),old);
 assert.equal(result.data.accepted,false,'Old Images owner must be rejected after Web restore');
 const after=await page.evaluate(()=>{const p=window.XTendPage.page.props['search.data'],m=window.XTendPage.getRuntime().model.getState('search.data');return {propsCategory:p.state.category,propsCount:p.results.length,modelCategory:m.state?.category??m.category,modelIds:m.results.map(row=>row.id),domCount:document.querySelectorAll('article.result').length};});
 assert.equal(after.propsCategory,'general');assert.equal(after.propsCount,10);assert.equal(after.modelCategory,'general');assert.deepEqual(after.modelIds,before);assert.equal(after.domCount,10);assert.equal(streams,1);
 assert.equal(await page.locator('article.result').count(),10);
 console.log(JSON.stringify({ok:true,oldImagesCount:images.results.length,rejected:true,propsCount:after.propsCount,modelCount:after.modelIds.length,domCount:after.domCount,streams}));
}finally{await browser.close();}
