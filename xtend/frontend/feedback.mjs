import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {categoryDraftUrl} from './filter-navigation.mjs';
import {emptyReport,decoratedReportData} from './report-state.mjs';
import './components/x-search-report-assistant.mjs';
// RMT is the only UI state owner. Transport contexts and proof maps stay local.
export function installFeedback(){
 let epoch=0,request,saving=false,commits=Promise.resolve(),guard=null,currentUrl=location.href,index=0,suppress=false,submitting=false,requestKey=null;
 const runtime=()=>window.XTendPage?.getRuntime(),model=()=>runtime()?.model.getState('search.feedback')||emptyReport();
 const state=(patch,own=epoch)=>{commits=commits.catch(()=>{}).then(()=>{if(own!==epoch)return;const previous=model(),feedback={...previous,...(typeof patch==='function'?patch(previous):patch)};feedback.canSave=!!feedback.selected?.length&&!!feedback.reason&&!feedback.busy;feedback.countLabel=feedback.selected.length?`${feedback.selected.length} von 5 Ergebnissen ausgewählt`:'Bitte bis zu fünf Ergebnisse auswählen.';const data=runtime().model.getState('search.data');return runtime().dispatchCommand('search.report.selection',{value:{feedback,results:decoratedReportData(data,feedback).results,cards:decoratedReportData(data,feedback).knowledgeCards}});});return commits;};
 const reset=async toast=>{epoch++;request?.abort();requestKey=null;await state({...emptyReport(),toast:toast||''});};
 const dirty=()=>model().open&&(model().selected.length||model().reason||model().includeUrl);
 async function confirm(){if(saving)return false;if(!dirty()){await reset();return true;}if(guard)return false;await runtime().ensureComponent('x-dialog');await state({confirm:true});return new Promise(resolve=>{guard=async ok=>{guard=null;document.getElementById('report-discard-dialog')?.close({source:'decision'});if(ok)await reset();else await state({confirm:false});resolve(ok);};});}
 document.addEventListener('dialog-closed',event=>{if(event.target.id==='report-discard-dialog'&&guard)void guard(false);});
 document.addEventListener('click',event=>{
  const id=event.target.closest?.('#report-start,#report-cancel,#report-save,#report-discard,#report-keep')?.id;if(!id||!runtime())return;
  event.preventDefault();event.stopImmediatePropagation();
  if(id==='report-start'){if(!model().open){requestKey=crypto.randomUUID();void state({...emptyReport(),open:true}).then(()=>document.getElementById('report-reason')?.focus({preventScroll:true}));}}
  if(id==='report-cancel')void confirm();
  if(id==='report-save')document.getElementById('feedback-form')?.requestSubmit();
  if(id==='report-discard'&&guard)void guard(true);
  if(id==='report-keep'&&guard)void guard(false);
 },true);
 document.addEventListener('change',event=>{
  if(!runtime())return;const field=event.target;
  if(field.matches('.report-checkbox')){
   const feedback=model();if(feedback.busy){field.checked=feedback.selected.some(r=>r.id===field.value);return;}
   const data=runtime().model.getState('search.data'),row=[...(data.results||[]),...(data.knowledgeCards||[])].find(r=>r.reportKey===field.value);if(!row?.reportTicket)return;
   requestKey=crypto.randomUUID();void state(current=>{const selected=current.selected.filter(r=>r.id!==field.value);if(field.checked){if(selected.length>=5)return {error:'Bitte höchstens fünf Ergebnisse auswählen.'};selected.push({id:row.reportKey,url:row.url||row.links?.[0]?.url||'',label:row.title});}return {selected,error:''};});
  }
  if(field.closest('#feedback-form')){requestKey=crypto.randomUUID();void state(field.name==='reason'?{reason:field.value,error:''}:field.name==='includeUrl'?{includeUrl:field.checked,error:''}:{});}
 },true);
 document.addEventListener('submit',async event=>{
  if(event.target.id!=='feedback-form'||!runtime())return;event.preventDefault();event.stopImmediatePropagation();if(saving)return;await commits;
  const feedback=model();if(!feedback.canSave)return;saving=true;const own=epoch;request=new AbortController();await state({busy:true,error:''},own);
  let registry,transport;
  try{
   const data=runtime().model.getState('search.data'),rows=[...(data.results||[]),...(data.knowledgeCards||[])],tickets=feedback.selected.map(s=>rows.find(r=>r.reportKey===s.id)?.reportTicket);if(tickets.some(t=>!t))throw Error('Die Auswahl ist nicht mehr verfügbar. Bitte erneut auswählen.');
   const params=new URLSearchParams();tickets.forEach(t=>params.append('ticket',t));
   const response=await fetch('/feedback/batch?'+params,{headers:{Accept:'application/json'},credentials:'same-origin',signal:AbortSignal.any([request.signal,AbortSignal.timeout(8000)])});if(!response.ok)throw Error('Ergebnisnachweise sind abgelaufen oder nicht verfügbar. Bitte die Suche erneut starten.');const context=await response.json();if(own!==epoch)return;
   transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services',headers:{'X-CSRF-Token':context.csrf}});registry=createAppServiceRegistry(services,{transport,historyLimit:0});
   const result=await registry.invoke('search.feedback.batch.submit',{tickets,reason:feedback.reason,includeUrl:feedback.includeUrl,requestKey},{},{signal:request.signal,timeoutMs:10000});
   if(own!==epoch)return;await runtime().ensureComponent('x-toast');await reset(result.message||'Meldung aufgenommen.');document.getElementById('report-start')?.focus({preventScroll:true});
  }catch(error){if(own===epoch)await state({busy:false,error:error.message||'Meldung konnte nicht gespeichert werden. Eingaben bleiben erhalten.'},own);}
  finally{registry?.dispose();transport?.dispose?.();saving=false;}
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
 window.addEventListener('pagehide',()=>{epoch++;request?.abort();if(guard)void guard(false);},{once:true});
}
