import {focusElement} from './browser-capabilities.mjs';
import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {categoryDraftUrl} from './filter-navigation.mjs';
import {emptyReport} from './report-state.mjs';
import {reportIsDirty} from './report-service-core.mjs';
// RMT is the only UI state owner. Transport contexts and proof maps stay local.
export function installFeedback(){
 const registry=createAppServiceRegistry(services,{historyLimit:0});
 let epoch=0,request,saving=false,commits=Promise.resolve(),guard=null,currentUrl=location.href,index=0,suppress=false,submitting=false,requestKey=null;
 const runtime=()=>window.XTendPage?.getRuntime(),model=()=>runtime()?.model.getState('search.feedback')||emptyReport();
 const state=(patch,own=epoch)=>{commits=commits.catch(()=>{}).then(()=>{if(own===epoch)return runtime().dispatchCommand('search.report.selection',{value:{patch}});});return commits;};
 const select=(id,checked)=>{const own=epoch;commits=commits.catch(()=>{}).then(()=>{if(own===epoch)return runtime().dispatchCommand('search.report.selection',{value:{selection:{id,checked}}});});return commits;};
 const reset=async toast=>{epoch++;request?.abort();requestKey=null;await state({...emptyReport(),toast:toast||''});};
 const dirty=()=>reportIsDirty(model());
 async function confirm(){if(saving)return false;if(!dirty()){await reset();return true;}if(guard)return false;await runtime().ensureComponent('x-dialog');await state({confirm:true});return new Promise(resolve=>{guard=async ok=>{guard=null;if(ok)await reset();else await state({confirm:false});resolve(ok);};});}
 document.addEventListener('dialog-closed',event=>{if(event.target.id==='report-discard-dialog'&&guard)void guard(false);});
 document.addEventListener('click',event=>{
  const id=event.target.closest?.('#report-start,#report-cancel,#report-save,#report-discard,#report-keep')?.id;if(!id||!runtime())return;
  event.preventDefault();event.stopImmediatePropagation();
  if(id==='report-start'){if(!model().open){requestKey=crypto.randomUUID();void state({...emptyReport(),open:true}).then(()=>focusElement(document.getElementById('report-reason'), {preventScroll:true}));}}
  if(id==='report-cancel')void confirm();
  if(id==='report-save')document.getElementById('feedback-form')?.requestSubmit();
  if(id==='report-discard'&&guard)void guard(true);
  if(id==='report-keep'&&guard)void guard(false);
 },true);
 document.addEventListener('change',event=>{
  if(!runtime())return;const field=event.target;
  if(field.matches('.report-checkbox')){
   const feedback=model();if(feedback.busy){void state({});return;}
   requestKey=crypto.randomUUID();void select(field.value,field.checked);
  }
  if(field.closest('#feedback-form')){requestKey=crypto.randomUUID();void state(field.name==='reason'?{reason:field.value,error:''}:field.name==='includeUrl'?{includeUrl:field.checked,error:''}:{});}
 },true);
 document.addEventListener('submit',async event=>{
  if(event.target.id!=='feedback-form'||!runtime())return;event.preventDefault();event.stopImmediatePropagation();if(saving)return;await commits;
  const feedback=model();if(!feedback.canSave)return;saving=true;const own=epoch;request=new AbortController();await state({busy:true,error:''},own);
  try{
   const data=runtime().model.getState('search.data');
   const result=await registry.invoke('search.report.submit',{feedback,data,requestKey},{},{signal:request.signal,timeoutMs:20000});
   if(own!==epoch)return;await runtime().ensureComponent('x-toast');await reset(result.message||'Meldung aufgenommen.');focusElement(document.getElementById('report-start'), {preventScroll:true});
  }catch(error){if(own===epoch)await state({busy:false,error:error.message||'Meldung konnte nicht gespeichert werden. Eingaben bleiben erhalten.'},own);}
  finally{saving=false;}
 },true);
 // This capture listener is installed before PageClient and mode-navigation.
 document.addEventListener('click',event=>{
  if(!runtime()||!dirty()&&!saving)return;const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('data-about-link'))return;
  const url=new URL(link.href);if(url.origin!==location.origin||!['/','/search'].includes(url.pathname))return;event.preventDefault();event.stopImmediatePropagation();
  const target=link.closest('.category-tabs')?categoryDraftUrl(link.href,new FormData(document.getElementById('search-form')),location.origin):url.href;void confirm().then(ok=>{if(ok)void window.XTendPage.visit(target,{cache:'reuse'});});
 },true);
 document.addEventListener('submit',event=>{
  if(event.target.id!=='search-form'||submitting||!runtime())return;
  if(!dirty()&&!saving)return;event.preventDefault();event.stopImmediatePropagation();const form=event.target,submitter=event.submitter;
  void confirm().then(ok=>{if(ok){submitting=true;form.requestSubmit(submitter);submitting=false;}});
 },true);
 window.addEventListener('popstate',event=>{
  if(suppress){event.stopImmediatePropagation();suppress=false;return;}const target=location.href,targetIndex=Number(event.state?.searchReportIndex)||0;
  if(!dirty()&&!saving){index=targetIndex;currentUrl=target;return;}event.stopImmediatePropagation();void confirm().then(ok=>{if(ok){index=targetIndex;currentUrl=target;void window.XTendPage.visit(target,{fromHistory:true,cache:'reuse',preserveScroll:true});}else{const delta=index-targetIndex;if(delta){suppress=true;history.go(delta);}else history.replaceState({...history.state,searchReportIndex:index},'',currentUrl);}});
 },true);
 window.addEventListener('beforeunload',event=>{if(dirty()||saving){event.preventDefault();event.returnValue='';}});
 window.addEventListener('xtend-page:ready',()=>{currentUrl=location.href;index=Number(history.state?.searchReportIndex)||0;history.replaceState({...history.state,searchReportIndex:index},'',location.href);});
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){epoch++;request?.abort();if(!guard)void state(emptyReport());}
  if(event.type==='navigate'&&location.href!==currentUrl){currentUrl=location.href;index=Number(history.state?.searchReportIndex)||index+1;history.replaceState({...history.state,searchReportIndex:index},'',location.href);}
 });
 document.addEventListener('toast-dismissed',event=>{if(event.target.classList.contains('feedback-toast'))void state({toast:''});});
 window.addEventListener('pagehide',()=>{epoch++;request?.abort();if(guard)void guard(false);registry.dispose();},{once:true});
}
