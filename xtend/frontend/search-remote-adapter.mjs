// Loaded exclusively by the XScaler SRI loader after its preflight accepts the
// result-surface plan. XTend's HTTP transport decodes the standard stream frames.
import {registerXScalerRemoteAdapter} from '@ccslabs/xtend/xscaler/remote-adapter-loader';
import {createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';

const sessionId=new URL(import.meta.url).searchParams.get('xscaler-session');
const http=createHttpAppServiceTransport({baseUrl:location.origin,pathPrefix:'/api/xtend/services',credentials:'same-origin',maxFrameBytes:2*1024*1024});
let attached=false;
const adapter={
 attach(){if(!document.getElementById('results'))throw new Error('Die Ergebnisfläche fehlt.');attached=true;},
 cancel(){attached=false;http.dispose('Search cancelled.');},
 detach(){attached=false;http.dispose('Search completed.');},
 dispose(){attached=false;http.dispose('Result surface disposed.');},
 async *stream(request,context){
  if(!attached)throw new Error('Result surface is not attached.');
  const signal=AbortSignal.any([request.signal,context.signal]);
  let terminal=false;
  for await(const frame of http.stream({...request,target:'server',signal})){
   if(frame.serviceId!==request.serviceId || frame.invocationId!==request.invocationId || frame.correlationId!==request.correlationId)throw new Error('Mismatched search stream.');
   terminal=['complete','error','cancelled'].includes(frame.type);
   yield frame;
   if(terminal)return;
  }
  if(!terminal)throw new Error('Search stream ended without a terminal frame.');
 }
};
// A module already in flight can execute after its navigation was cancelled.
// A closed registration slot is then expected: release it without a global error.
// An active loader still rejects a missing registration through its own contract.
if(!registerXScalerRemoteAdapter({surfaceId:'remoteSurface:search.results',sessionId,adapter}))http.dispose('Result session ended before registration.');
