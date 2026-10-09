import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {preserveFilterDraft} from './filter-navigation.mjs';
// Presentation coordinator for the existing PageClient. The SDK owns framing,
// sequencing, transport, cancellation and stale invocations. No second router.
export function installSearchStreaming(){
 let active=null,epoch=0;const positions=new Map();let restoring=null;
 const client=()=>window.XTendPage;
 const stop=()=>{epoch++;active?.controller.abort();active=null;};
 async function run(stream){
  stop();const own=epoch,controller=new AbortController(),transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services'}),registry=createAppServiceRegistry(services,{transport,historyLimit:0});
  const record={id:stream.id,controller};active=record;const valid=()=>active===record&&epoch===own&&!controller.signal.aborted&&client()?.page?.props?.['search.data']?.stream?.id===stream.id;
  try{
   const frames=registry.stream('search.run',{url:stream.url},{},{signal:controller.signal,invocationId:stream.id,correlationId:stream.id,timeoutMs:15000});
   for await(const frame of frames){
    if(!valid())return;if(frame.type==='start')continue;
    if(['error','cancelled'].includes(frame.type))throw new Error('Stream unterbrochen');
    const payload=frame.value??frame.delta;if(!payload?.data)continue;
    const final=frame.type==='complete';
    // At most one pending commit: await one animation frame and Maraca's commit.
    // The stream iterator supplies backpressure; there is no unbounded UI queue.
    await new Promise(resolve=>requestAnimationFrame(resolve));if(!valid())return;
    await client().optimistic(props=>valid()?{...preserveFilterDraft(props),'search.data':{...payload.data,stream:{...stream,phase:final?'complete':'partial'}}}:props,async()=>undefined);
    window.dispatchEvent(new CustomEvent('xtend-search:stream',{detail:{id:stream.id,status:frame.type,event:payload.event,sequence:frame.sequence}}));
    if(restoring&&(document.documentElement.scrollHeight-innerHeight>=restoring[1]||final)){scrollTo(...restoring);restoring=null;}
    if(final)return;
   }
   throw new Error('Unvollständiger Stream');
  }catch{
   if(valid())await client().optimistic(props=>({...preserveFilterDraft(props),'search.data':{...props['search.data'],skeleton:false,stream:{...stream,phase:'error'},statusLabel:'Verbindung unterbrochen · bereits geladene Ergebnisse bleiben sichtbar',warnings:[{id:'stream',domId:'search-warning-stream',type:'warning',message:'Die Verbindung wurde unterbrochen. Bitte starte bei Bedarf eine neue Suche.'}]}}),async()=>undefined);
  }finally{registry.dispose();transport.dispose?.();if(active===record)active=null;}
 }
 window.addEventListener('popstate',()=>{restoring=positions.get(location.pathname+location.search)||null;},true);
 for(const type of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(type,()=>{restoring=null;},{passive:true});
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){const page=client()?.page;if(page){positions.set(page.url,[scrollX,scrollY]);if(positions.size>20)positions.delete(positions.keys().next().value);}stop();}
  if(event.type==='navigate'){const stream=event.page.props?.['search.data']?.stream;if(stream?.phase==='pending'&&active?.id!==stream.id)void run(stream).catch(()=>{});}
 });
 window.addEventListener('pagehide',stop);
}
