import {focusElement} from './browser-capabilities.mjs';
// Native anchors are the no-JS fallback. RMT owns the persistent overlay.
import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {updateOverlay} from './overlay-controller.mjs';
export function installAbout(){
 const registry=createAppServiceRegistry(services,{historyLimit:0});let epoch=0,opener=null;
 const runtime=()=>window.XTendPage?.getRuntime();
 const state=patch=>{const own=epoch;return updateOverlay(patch,()=>own===epoch);};
 const reset=()=>{epoch++;if(runtime())void state({about:false}).catch(()=>{});};
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')reset();});
 document.addEventListener('dialog-closed',event=>{if(event.target.id==='search-about'){void state({about:false}).catch(()=>{});queueMicrotask(()=>opener?.isConnected&&focusElement(opener, {preventScroll:true}));}});
 document.addEventListener('click',async event=>{
  const link=event.target.closest?.('a[data-about-link]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!runtime())return;
  event.preventDefault();event.stopImmediatePropagation();const own=epoch;opener=link;
  try{const copy=await registry.invoke('search.about.content',{});await runtime().ensureComponent('x-dialog');if(own===epoch&&link.isConnected){focusElement(link, {preventScroll:true});await state({about:true,copy});}}
  catch{if(own===epoch)location.assign(link.href);}
 },true);
 window.addEventListener('pagehide',()=>{epoch++;registry.dispose();},{once:true});
}
