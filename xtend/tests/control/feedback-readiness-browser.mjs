// Test-only deferred commit; no application/SDK source or timer is changed.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {waitForFeedbackSave} from './feedback-readiness.mjs';
const browser=await chromium.launch(),page=await browser.newPage();
try{
 await page.goto((process.env.TEST_BASE_URL||'http://localhost:8093')+'/search?q=feedback-readiness&categories=general');
 await page.waitForFunction(()=>window.XTendPage?.getRuntime());
 await page.locator('#report-start').click();
 await page.locator('.report-checkbox').first().check();
 await page.waitForFunction(()=>window.XTendPage.getRuntime().model.getState('search.feedback').selected.length===1);
 await page.evaluate(()=>{
  const client=window.XTendPage,getRuntime=client.getRuntime.bind(client);
  const runtime=getRuntime(),dispatch=runtime.dispatchCommand.bind(runtime);
  // The SDK facade is frozen. Wrap it in this browser session; never mutate it.
  const instrumented=Object.create(runtime);
  const model=Object.create(runtime.model);
  Object.defineProperty(model,'getState',{value:name=>{
   const state=runtime.model.getState(name);
   if(name==='search.feedback'&&window.feedbackCommitHeld&&!window.feedbackCommitReleased&&!state.canSave)
    window.feedbackReadinessPolledWhileHeld=true;
   return state;
  }});
  Object.defineProperty(instrumented,'model',{value:model});
  client.getRuntime=()=>instrumented;
  Object.defineProperty(instrumented,'dispatchCommand',{value:async(name,args,...rest)=>{
   if(name==='search.report.selection'&&args.value.patch?.reason==='spam'){
    await new Promise(resolve=>{window.releaseFeedbackCommit=resolve;window.feedbackCommitHeld=true;});
    client.getRuntime=getRuntime;
   }
   return dispatch(name,args,...rest);
  }});
 });
 await page.locator('#feedback-form select').selectOption('spam');
 await page.waitForFunction(()=>window.feedbackCommitHeld);
 const held=await page.evaluate(()=>{
  const feedback=window.XTendPage.getRuntime().model.getState('search.feedback');
  return {open:feedback.open,selected:feedback.selected.length,reason:feedback.reason,canSave:feedback.canSave,busy:feedback.busy,
   nativeDisabled:document.getElementById('report-save').shadowRoot.querySelector('button').disabled};
 });
 assert.deepEqual(held,{open:true,selected:1,reason:'spam',canSave:false,busy:false,nativeDisabled:true});
 await page.evaluate(()=>{window.feedbackReadinessPolledWhileHeld=false;});
 let readyResolved=false;
 const ready=waitForFeedbackSave(page).then(()=>{readyResolved=true;});
 await page.waitForFunction(()=>window.feedbackReadinessPolledWhileHeld);
 assert.equal(readyResolved,false,'Readiness must not resolve while the commit is held');
 await page.evaluate(()=>{window.feedbackCommitReleased=true;window.releaseFeedbackCommit();});
 await ready;
 await page.locator('#report-save').click();
 await page.waitForFunction(()=>document.querySelector('.feedback-toast'));
 console.log(JSON.stringify({ok:true,held,readyClickAccepted:true}));
}finally{await browser.close();}
