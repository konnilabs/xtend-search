import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
// RMT owns dialog, fields, validation copy, busy state and toast. This adapter
// owns only the short-lived signed proof/CSRF and the cancellable service call.
export function installFeedback(){
 let epoch=0,request,registry,transport,opener,position,overflow,inert=[],resetting=false;
 const runtime=()=>window.XTendPage?.getRuntime();
 const model=()=>runtime()?.model.getState('search.feedback');
 let commits=Promise.resolve();
 const set=(value,own=epoch)=>{commits=commits.catch(()=>{}).then(()=>{if(own===epoch)return runtime()?.dispatchCommand('search.feedback.state',{value});});return commits;};
 const restore=()=>{if(!inert.length&&overflow===undefined)return;const target=opener,scroll=position;position=undefined;for(const [node,value]of inert)node.inert=value;inert=[];if(overflow!==undefined){document.documentElement.style.overflow=overflow;overflow=undefined;}queueMicrotask(()=>queueMicrotask(()=>{if(inert.length)return;if(target?.isConnected)target.focus({preventScroll:true});if(scroll)scrollTo(...scroll);}));};
 const reset=()=>{if(resetting)return;resetting=true;epoch++;request?.abort();registry?.dispose();transport?.dispose?.();registry=null;transport=null;document.getElementById('search-feedback')?.close({source:'search-reset'});restore();void set({open:false,busy:false,url:'',reason:'',includeUrl:false,error:'',toast:''}).catch(()=>{});resetting=false;};
 document.addEventListener('dialog-opened',event=>{if(event.target.id!=='search-feedback')return;
  position=[scrollX,scrollY];overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  // The RMT dialog is inside the page surface: inert sibling branches, never
  // an ancestor of the dialog. XDialog owns its focus trap and Escape handling.
  for(let node=event.target;node&&node!==document.body;node=node.parentElement){for(const sibling of node.parentElement?.children||[]){if(sibling!==node){inert.push([sibling,sibling.inert]);sibling.inert=true;}}}
 });
 document.addEventListener('dialog-closed',event=>{if(event.target.id==='search-feedback')reset();});
 document.addEventListener('toast-dismissed',event=>{if(event.target.classList.contains('feedback-toast'))void set({...model(),toast:''}).catch(()=>{});});
 document.addEventListener('click',async event=>{
  const link=event.target.closest?.('a[data-report]');if(!link||event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!runtime())return;
  event.preventDefault();event.stopImmediatePropagation();reset();opener=link;const own=epoch;request=new AbortController();
  try{
   const [response]=await Promise.all([fetch(link.href,{headers:{Accept:'application/json'},credentials:'same-origin',signal:AbortSignal.any([request.signal,AbortSignal.timeout(8000)])}),runtime().ensureComponent('x-dialog'),runtime().ensureComponent('x-toast')]);
   if(!response.ok)throw Error('context');const context=await response.json();if(own!==epoch)return;
   transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services',headers:{'X-CSRF-Token':context.csrf}});registry=createAppServiceRegistry(services,{transport,historyLimit:0});
   request.context=context;
   await set({open:true,busy:false,url:context.url,reason:'',includeUrl:false,error:'',toast:''},own);
  }catch(error){if(own===epoch&&error.name!=='AbortError')location.assign(link.href);}
 },true);
 document.addEventListener('submit',async event=>{
  if(event.target.id!=='feedback-form'||!model()?.open)return;event.preventDefault();event.stopImmediatePropagation();if(model().busy||!registry)return;
  const own=epoch,context=request.context,form=event.target;
  const values={...model(),reason:form.elements.reason.value,includeUrl:form.elements.includeUrl.checked,busy:true,error:''};await set(values,own);if(own!==epoch)return;
  try{
   const result=await registry.invoke('search.feedback.submit',{ticket:context.ticket,reason:values.reason,includeUrl:values.includeUrl},{},{signal:request.signal,timeoutMs:10000});
   if(own!==epoch)return;
   // XDialog's closed event must not erase the new toast. Close first, then
   // publish a fresh terminal state in the new generation.
   document.getElementById('search-feedback')?.close({source:'submitted'});
   await set({open:false,busy:false,url:'',reason:'',includeUrl:false,error:'',toast:result.message||'Meldung aufgenommen.'});
  }catch(error){if(own===epoch)await set({...values,busy:false,error:error.message||'Meldung nicht angenommen. Bitte erneut versuchen.'},own);}
 },true);
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')reset();});
 window.addEventListener('pagehide',reset);
}
