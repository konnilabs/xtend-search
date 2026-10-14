import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {decoratedReportData} from './report-state.mjs';
import {interruptedSearch} from './stream-service-core.mjs';
import {preserveFilterDraft} from './filter-navigation.mjs';
// Presentation coordinator for the existing PageClient. The SDK owns framing,
// sequencing, transport, cancellation and stale invocations. No second router.
export function installSearchStreaming(){
 let active=null,epoch=0;const positions=new Map();let restoring=null;
 const client=()=>window.XTendPage;
 const stop=()=>{epoch++;active?.controller.abort();active=null;};
 async function run(stream){
  stop();const own=epoch,controller=new AbortController(),registry=createAppServiceRegistry(services,{historyLimit:0});
  const record={id:stream.id,controller};active=record;const valid=()=>active===record&&epoch===own&&!controller.signal.aborted&&client()?.page?.props?.['search.data']?.stream?.id===stream.id;
  try{
   await registry.invoke('search.stream.consume',{stream,origin:location.origin},{present:async payload=>{
    if(!valid())throw new DOMException('Stale page','AbortError');
    const final=payload.data.stream.phase==='complete';
    await new Promise(resolve=>requestAnimationFrame(resolve));if(!valid())throw new DOMException('Stale page','AbortError');
    await client().optimistic(props=>valid()?{...preserveFilterDraft(props),'search.data':decoratedReportData(payload.data,client()?.getRuntime()?.model.getState('search.feedback'))}:props,async()=>undefined);
    if(!valid())return;
    window.dispatchEvent(new CustomEvent('xtend-search:stream',{detail:{id:stream.id,status:payload.status,event:payload.event,sequence:payload.sequence}}));
    if(restoring&&(document.documentElement.scrollHeight-innerHeight>=restoring[1]||final)){scrollTo(...restoring);restoring=null;}
   }},{signal:controller.signal,invocationId:stream.id,timeoutMs:18000});
  }catch{
   if(valid())await client().optimistic(props=>({...preserveFilterDraft(props),'search.data':interruptedSearch(props['search.data'],stream)}),async()=>undefined);
  }finally{registry.dispose();if(active===record)active=null;}
 }
 window.addEventListener('popstate',()=>{restoring=positions.get(location.pathname+location.search)||null;},true);
 for(const type of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(type,()=>{restoring=null;},{passive:true});
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){const page=client()?.page;if(page){positions.set(page.url,[scrollX,scrollY]);if(positions.size>20)positions.delete(positions.keys().next().value);}stop();}
  if(event.type==='navigate'){const stream=event.page.props?.['search.data']?.stream;if(stream?.phase==='pending'&&active?.id!==stream.id)void run(stream).catch(()=>{});}
 });
 window.addEventListener('pagehide',stop);
}
