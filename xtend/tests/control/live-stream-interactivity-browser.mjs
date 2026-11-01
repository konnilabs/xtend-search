// Opt-in live PoC: real local Docker service, no fixtures, routes or delayed frames.
// Writes timings/counts only; queries, result URLs, tickets and payloads stay out
// of the JSON report. Screenshots contain public search content; keep them local.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const base=new URL(process.env.TEST_BASE_URL||'http://localhost:8090');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname),'This opt-in test is limited to a local instance');
const output=path.resolve(process.env.POC_OUTPUT_DIR||'/tmp/xtend-stream-interactivity');
const modes=(process.env.POC_MODES||'link,rmt-selection').split(',');
assert.ok(modes.length&&modes.every(mode=>['link','rmt-selection'].includes(mode)));
await fs.mkdir(output,{recursive:true});
const health=await fetch(new URL('/health/ready',base)).then(response=>{assert.equal(response.status,200);return response.json();});
assert.equal(health.ok,true);
const browser=await chromium.launch(),runs=[];
try{
 for(const mode of modes){
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
  const page=await context.newPage(),errors=[],network=[],requests={searchStreams:0,feedbackSubmissions:0},streamRequests=new Map();
  let externalNavigation=null,expectedTarget=null,popup=null,popupOpened=null;
  context.on('page',created=>{if(created!==page){popup=created;popupOpened=Date.now();}});
  page.on('pageerror',error=>errors.push(error.message));
  context.on('request',request=>{
   const url=new URL(request.url());
   if(url.pathname.endsWith('/search.run'))requests.searchStreams++;
   if(/feedback.*submit|\/feedback\/batch/.test(url.pathname)&&request.method()==='POST')requests.feedbackSubmissions++;
   // A new noreferrer tab can issue its first request before Playwright has
   // created a Frame. Match the actual clicked URL without accessing frame().
   if(request.isNavigationRequest()&&url.href===expectedTarget&&externalNavigation===null)
    externalNavigation={atEpochMs:Date.now(),requested:true};
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent',event=>{
   if(new URL(event.request.url).pathname.endsWith('/search.run')){
    streamRequests.set(event.requestId,{offset:event.wallTime-event.timestamp});
    network.push({kind:'request',epochMs:event.wallTime*1000});
   }
  });
  for(const [name,kind] of [['Network.dataReceived','data'],['Network.loadingFinished','finished'],['Network.loadingFailed','failed']])
   cdp.on(name,event=>{const request=streamRequests.get(event.requestId);if(request)network.push({kind,epochMs:(event.timestamp+request.offset)*1000,bytes:event.dataLength??event.encodedDataLength??0});});
  // Dispatch trusted browser input immediately after a painted, unobstructed
  // target is observed. Avoid test-driver polling/round trips eating the short
  // live-provider window. This only instruments the test; app and SDK are intact.
  await page.exposeBinding('__streamProofInput',async(_source,{kind,point,href})=>{
   if(kind==='result-link'){
    const target=new URL(href,base);assert.ok(['https:','http:'].includes(target.protocol)&&target.origin!==base.origin);expectedTarget=target.href;
   }
   const modifiers=kind==='result-link'?2:0;
   await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1,modifiers});
   await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1,modifiers});
  });
  await page.addInitScript(mode=>{
   const state=()=>({count:document.querySelectorAll('article.result').length,phase:window.XTendPage?.page?.props?.['search.data']?.stream?.phase??null,busy:window.XTendPage?.getRuntime()?.model.getState('search.activity')?.busy??null,spinner:!!document.querySelector('.search-button x-spinner')});
   window.streamProof={started:null,frames:[],clicks:[],paint:null,selection:null,selectionHistory:[],terminal:null};
   function point(element){
    if(!element)return null;
    const box=[...element.getClientRects()].find(rect=>rect.width>0&&rect.height>0&&rect.top>=0&&rect.bottom<=innerHeight);
    if(!box)return null;const x=box.left+box.width/2,y=box.top+box.height/2,hit=document.elementFromPoint(x,y);
    return hit&&(element===hit||element.contains(hit))?{x,y}:null;
   }
   function input(kind,element){const position=point(element);if(!position)return false;void window.__streamProofInput({kind,point:position,href:element.href}).catch(error=>{window.streamProof.inputError=error.message;});return true;}
   addEventListener('xtend-search:stream',({detail})=>{
    const proof=window.streamProof;if(proof.started===null)return;
    proof.frames.push({ms:performance.now()-proof.started,event:detail.event,status:detail.status,sequence:detail.sequence,...state()});
    // Two animation frames distinguish committed DOM from a subsequent paint.
    if(!proof.paint&&document.querySelector('article.result h2 a'))requestAnimationFrame(()=>requestAnimationFrame(()=>{
     if(proof.paint)return;const link=document.querySelector('article.result h2 a');if(!link)return;
     proof.paint={ms:performance.now()-proof.started,visible:!!point(link),...state()};
     input(mode==='link'?'result-link':'assistant-open',mode==='link'?link:document.getElementById('report-start'));
    }));
   });
   document.addEventListener('click',event=>{
    if(window.streamProof.started===null)return;
    const target=event.target.closest?.('article.result h2 a,#report-start,.report-checkbox');if(!target)return;
    window.streamProof.clicks.push({ms:performance.now()-window.streamProof.started,kind:target.matches('a')?'result-link':target.id==='report-start'?'assistant-open':'result-select',trusted:event.isTrusted,ctrl:event.ctrlKey,...state()});
   },true);
   let checkboxRequested=false;
   if(mode==='rmt-selection')new MutationObserver(()=>{
    const proof=window.streamProof;if(!proof.paint)return;
    if(!checkboxRequested&&document.querySelector('#report-assistant'))checkboxRequested=input('result-select',document.querySelector('.report-checkbox'));
    const feedback=window.XTendPage?.getRuntime()?.model.getState('search.feedback');
    if(!proof.selection&&feedback?.selected.length===1&&document.querySelector('.report-checkbox:checked')&&document.querySelector('article.result[data-report-selected]'))
     proof.selection={ms:performance.now()-proof.started,...state(),selected:feedback.selected.length,assistantVisible:true,checked:true,highlighted:true};
    if(feedback?.selected.length){
     const value={...state(),selected:feedback.selected.length,checked:document.querySelectorAll('.report-checkbox:checked').length,highlighted:document.querySelectorAll('article.result[data-report-selected]').length,
      selectedRowsPresent:feedback.selected.every(selected=>window.XTendPage.getRuntime().model.getState('search.data').results.some(row=>row.reportKey===selected.id))};
     if(JSON.stringify(value)!==JSON.stringify(proof.selectionHistory.at(-1)?.value))proof.selectionHistory.push({ms:performance.now()-proof.started,value});
    }
   }).observe(document,{subtree:true,childList:true,attributes:true});
  },mode);
  let failure=null;
  try{
   await page.goto(base.href);await page.waitForFunction(()=>window.XTendPage?.getRuntime());
   await page.locator('#search-input').fill(process.env.POC_QUERY||'GNU Linux');
   await page.evaluate(()=>window.streamProof.started=performance.now());
   await page.locator('.search-button').click();
   if(mode==='link'){
    // noreferrer severs the opener; observe the BrowserContext's page event.
    await page.waitForFunction(()=>window.streamProof.clicks.some(click=>click.kind==='result-link'),null,{timeout:20000});
    if(!popup)popup=await context.waitForEvent('page',{timeout:5000});
    // Wait for a real target navigation, not the new tab's initial about:blank.
    const navigation=popup.waitForURL(url=>url.protocol==='https:'||url.protocol==='http:',{waitUntil:'domcontentloaded',timeout:12000}).then(async()=>({loaded:true,hasContent:(await popup.locator('body').innerText()).trim().length>0})).catch(error=>({loaded:false,error:error.name}));
    await page.screenshot({path:path.join(output,'link-observation.png'),fullPage:false});
    await page.waitForFunction(()=>window.streamProof.frames.some(frame=>frame.status==='complete'),null,{timeout:20000});
    const targetResult=await navigation;
    await page.evaluate(value=>window.streamProof.external=value,targetResult);
   }else{
    await page.waitForFunction(()=>window.streamProof.selection,null,{timeout:20000});
    await page.screenshot({path:path.join(output,'rmt-selection-observation.png'),fullPage:false});
    await page.waitForFunction(()=>window.streamProof.frames.some(frame=>frame.status==='complete'),null,{timeout:20000});
   }
   await page.waitForFunction(()=>!window.XTendPage.getRuntime().model.getState('search.activity').busy&&!document.querySelector('.search-button x-spinner'),null,{timeout:5000});
   await page.evaluate(()=>{window.streamProof.terminal={ms:performance.now()-window.streamProof.started,count:document.querySelectorAll('article.result').length,phase:window.XTendPage.page.props['search.data'].stream.phase,busy:window.XTendPage.getRuntime().model.getState('search.activity').busy,spinner:!!document.querySelector('.search-button x-spinner'),selected:window.XTendPage.getRuntime().model.getState('search.feedback').selected.length,highlighted:!!document.querySelector('article.result[data-report-selected]')};});
   if(mode==='rmt-selection')await page.screenshot({path:path.join(output,'rmt-selection-after-stream.png'),fullPage:false});
  }catch(error){failure=error.message;}
  const proof=await page.evaluate(()=>({...window.streamProof,timeOrigin:performance.timeOrigin}));
  const epoch=proof.timeOrigin+proof.started;delete proof.timeOrigin;delete proof.started;
  if(proof.external)proof.external.openedMs=popupOpened-epoch;
  const rounded=value=>Math.round(value*10)/10;
  const run={mode,...proof,network:network.map(({epochMs,...event})=>({...event,ms:rounded(epochMs-epoch)})),externalNavigation:externalNavigation?{requested:true,ms:rounded(externalNavigation.atEpochMs-epoch)}:null,requests,errors,failure};
  try{
   assert.equal(failure,null);assert.deepEqual(errors,[]);assert.equal(requests.searchStreams,1);assert.equal(requests.feedbackSubmissions,0);
   const interaction=run.clicks.find(click=>click.kind===(mode==='link'?'result-link':'result-select'));
   const complete=run.frames.find(frame=>frame.status==='complete');
   assert.ok(run.paint.visible&&run.paint.phase==='partial');assert.ok(interaction&&interaction.phase==='partial');
   assert.ok(run.clicks.every(click=>click.trusted),'Only actual browser input counts');
   assert.ok(run.frames.some(frame=>frame.event==='results.batch'&&frame.ms>interaction.ms&&frame.count>interaction.count),'A later result batch must arrive after the interaction');
   assert.ok(interaction.ms<complete.ms);assert.equal(run.terminal.phase,'complete');assert.equal(run.terminal.busy,false);assert.equal(run.terminal.spinner,false);
   if(mode==='link'){
    assert.ok(run.network.some(event=>event.kind==='data'&&event.ms>interaction.ms),'Real stream bytes must arrive after the link interaction');
    assert.ok(run.externalNavigation?.ms<complete.ms,'Target navigation must start before stream completion');
    assert.ok(run.external.openedMs<complete.ms,'The new tab must open before stream completion');
    assert.equal(run.external.loaded,true);assert.equal(run.external.hasContent,true);
   }else{
    assert.equal(run.selection.selected,1);assert.equal(run.selection.checked,true);assert.equal(run.selection.highlighted,true);assert.equal(run.selection.phase,'partial');
    assert.equal(run.terminal.selected,1,'Later batches must retain RMT selection');assert.equal(run.terminal.highlighted,true,'Visible result selection must agree with retained RMT state after later updates');
    assert.ok(run.selectionHistory.every(({value})=>!value.selectedRowsPresent||value.checked===value.selected&&value.highlighted===value.selected),'A selected result must not temporarily lose its checkbox/highlight during subsequent updates');
   }
   run.ok=true;
  }catch(error){run.ok=false;run.assertion=error.message;}
  runs.push(run);
  console.log(JSON.stringify({mode,ok:run.ok,firstPaintMs:run.paint?.ms,interactionMs:(run.selection??run.clicks.find(click=>click.kind==='result-link'))?.ms,completeMs:run.frames.find(frame=>frame.status==='complete')?.ms,counts:run.frames.map(frame=>frame.count),assertion:run.assertion??null}));
  if(popup)await popup.close().catch(()=>{});
  // Discard the local draft through real UI. Never submit a quality report.
  if(mode==='rmt-selection'&&await page.locator('#report-cancel').count()){
   await page.locator('#report-cancel').click();if(await page.locator('#report-discard').count())await page.locator('#report-discard').click();
  }
  await context.close();
 }
}finally{await browser.close();}
const report={ok:runs.length===modes.length&&runs.every(run=>run.ok),at:new Date().toISOString(),version:health.version,scope:'Unmodified local Docker instance; real provider responses, trusted browser input via CDP and network observation. No mock, throttling, artificial delays, policy changes or submitted feedback. Fresh isolated Chromium contexts. Timings are observations of these runs, not an SLA. Queries/URLs/tickets/payloads are omitted.',viewport:{width:1440,height:1000},runs};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
assert.equal(report.ok,true,'Live PoC incomplete: inspect report.json. A run with no later batch is inconclusive, not a feature regression.');
