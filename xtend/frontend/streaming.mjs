import {createXScalerAppServiceTransport} from '@ccslabs/xtend/xscaler/app-service-transport';
import {createXScalerRemoteSurfacePlan} from '@ccslabs/xtend/xscaler/protocol';
import {createAppServiceRegistry,defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';

// XTend owns URL/history and every DOM commit. This adapter only connects the
// preflighted result surface to its AppService and publishes props through the
// documented page update API. No fetch interception or second router.
export function installSearchStreaming(){
 let active=null,epoch=0,restoring=null;
 const positions=new Map();
 const client=()=>window.XTendPage;
 const publish=detail=>window.dispatchEvent(new CustomEvent('xtend-search:stream',{detail}));
 const data=()=>client()?.page?.props?.['search.data'];
 function stop(){epoch++;active?.controller.abort();active=null;}
 function restoreScroll(final){
  if(!restoring)return;
  if(document.documentElement.scrollHeight-innerHeight>=restoring[1] || final){scrollTo(...restoring);restoring=null;}
 }
 function transportFor(id){
  const origin=location.origin,sessionId=`search:${id}`;
  const adapterUrl=new URL('/assets/xtend/search-remote-adapter.mjs',origin);adapterUrl.searchParams.set('xscaler-session',sessionId);
  const plan=createXScalerRemoteSurfacePlan({surface:'search.results',surfaceId:'remoteSurface:search.results',owner:'xtend.search',origin,
   integrity:{algorithm:'sha256',digest:'sha256-'+__SEARCH_STREAM_INTEGRITY__},fallbackSurface:'search.results.classic',
   lanes:[{lane:'visible',target:'search.results'}],ssr:{mode:'server_prerender_resume',networkDuringRender:false}});
  return createXScalerAppServiceTransport({
   loaderOptions:{documentTarget:document,registrationTarget:window,allowInsecureLoopback:['localhost','127.0.0.1','[::1]'].includes(location.hostname),activateFallback:()=>publish({id,status:'fallback'})},
   services:{'search.results':{remoteSurfacePlan:plan,adapterUrl:adapterUrl.href,sessionId,hostCapabilities:{allowedOrigins:[origin]},nonce:document.getElementById('xtend-page-data')?.nonce || ''}}
  });
 }
 async function run(stream){
  stop();const current=epoch,controller=new AbortController(),transport=transportFor(stream.id);
  const registry=createAppServiceRegistry(defineAppServices({'search.results':service({kind:'stream',target:'remote-surface',concurrency:'latest'})}),{transport,historyLimit:1});
  const record={controller,id:stream.id};active=record;
  const valid=()=>active===record && epoch===current && !controller.signal.aborted && data()?.stream?.id===stream.id;
  let delivered=false;
  try{
   const frames=registry.stream('search.results',{url:stream.url},{},{signal:controller.signal,invocationId:stream.id,correlationId:stream.id,timeoutMs:15000});
   for await(const frame of frames){
    if(!valid())return;
    publish({id:stream.id,status:frame.type,sequence:frame.sequence});
    if(frame.type==='start')continue;
    if(frame.type==='error' || frame.type==='cancelled')throw new Error('Search stream failed.');
    const value=frame.value ?? frame.delta;
    if(!value || !['delta','complete'].includes(frame.type))continue;
    if(value.redirect){const target=new URL(value.redirect);if(!['https:','http:'].includes(target.protocol))throw new Error('Invalid redirect.');location.assign(target.href);return;}
    const final=frame.type==='complete';
    await client().optimistic(props=>valid()?{...props,'search.data':{...value,skeleton:false,stream:{...stream,phase:final?'complete':'partial'}}}:props,async()=>undefined);
    if(!valid())return;
    delivered=delivered || value.results?.length>0 || value.hasKnowledge;
    restoreScroll(final);
    if(final)return;
   }
   throw new Error('Search ended without final results.');
  }catch(error){
   if(!valid())return;
   publish({id:stream.id,status:'failed',code:error.code || error.name});
   if(!delivered){
    // Exactly one conventional SPA retry. SSR and the native form remain usable.
    await client().visit(stream.url,{replace:true,headers:{'X-XTend-Stream':'off'}});
   }else{
    await client().optimistic(props=>({...props,'search.data':{...props['search.data'],stream:{...stream,phase:'error'},countLabel:`${props['search.data'].results.length} Ergebnisse · Suche unvollständig`,warnings:[...props['search.data'].warnings,{id:'stream-error',domId:'search-warning-stream-error',type:'warning',message:'Die Verbindung wurde unterbrochen. Bereits empfangene Ergebnisse bleiben verfügbar. Bitte erneut suchen, um die Suche abzuschließen.'}]}}),async()=>undefined);
   }
  }finally{
   registry.dispose('Search finished.');transport.dispose('Search finished.');await transport.whenDisposed();
   publish({id:stream.id,status:'disposed',transport:transport.snapshot()});
   if(active===record)active=null;
  }
 }
 window.addEventListener('popstate',()=>{restoring=positions.get(location.pathname+location.search) || null;},true);
 for(const type of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(type,()=>{restoring=null;},{passive:true});
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){
   const page=client()?.page;if(page){positions.set(page.url,[scrollX,scrollY]);if(positions.size>20)positions.delete(positions.keys().next().value);}
   stop();
  }
  if(event.type==='navigate'){
   const stream=event.page.props?.['search.data']?.stream;
   if(stream?.phase==='pending' && active?.id!==stream.id)void run(stream).catch(()=>{});
  }
 });
 window.addEventListener('pagehide',stop);
}
