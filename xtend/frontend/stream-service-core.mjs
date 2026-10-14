import {decoratedReportData} from './report-state.mjs';
import {createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
// A command uses the SDK transport's pull iterator and awaits the PageClient port.
// The pinned registry's stream queue is eager; nesting stream registries would
// buffer frames independently of presentation and defeat backpressure.
export async function presentSearchFrames(frames,{signal,present,readFeedback=()=>null},stream){
 for await(const frame of frames){
  signal.throwIfAborted();if(frame.type==='start')continue;
  if(['error','cancelled'].includes(frame.type))throw Error('Stream unterbrochen');
  const payload=frame.value??frame.delta;if(!payload?.data)continue;
  const final=frame.type==='complete';if(!final&&payload.event==='search.started')continue;
  await present({data:{...decoratedReportData(payload.data,readFeedback()),stream:{...stream,phase:final?'complete':'partial'}},status:frame.type,event:payload.event,sequence:frame.sequence});
  signal.throwIfAborted();if(final)return true;
 }
 throw Error('Unvollständiger Stream');
}
export async function consumeSearchStream({stream,origin},{signal,present,readFeedback=()=>null}){
 const transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services'});
 try{
  const serviceId=new URL(stream.url,origin).searchParams.get('categories')==='weather'?'search.weather.run':'search.run';
  return await presentSearchFrames(transport.stream({serviceId,kind:'stream',target:'server',input:{url:stream.url},signal,invocationId:stream.id,correlationId:stream.id,context:{}}),{signal,present,readFeedback},stream);
 }finally{transport.dispose?.();}
}
export function interruptedSearch(data,stream){return {...data,skeleton:false,countLabel:data.skeleton?'Suche unterbrochen':data.countLabel,stream:{...stream,phase:'error'},statusLabel:'Verbindung unterbrochen · bereits geladene Ergebnisse bleiben sichtbar',warnings:[{id:'stream',domId:'search-warning-stream',type:'warning',message:'Die Verbindung wurde unterbrochen. Bitte starte bei Bedarf eine neue Suche.'}]};}
export async function consumeRemoteStream({stream},{signal,createFrames,present}){
 for await(const frame of createFrames(signal)){
  signal.throwIfAborted();if(frame.type==='start')continue;
  if(['error','cancelled'].includes(frame.type))throw Error('Search stream failed.');
  const value=frame.value??frame.delta;if(!value||!['delta','complete'].includes(frame.type))continue;
  if(value.redirect){const target=new URL(value.redirect);if(!['http:','https:'].includes(target.protocol))throw Error('Invalid redirect.');await present({redirect:target.href});return true;}
  const final=frame.type==='complete';
  await present({data:{...value,skeleton:false,stream:{...stream,phase:final?'complete':'partial'}},status:frame.type,sequence:frame.sequence});
  signal.throwIfAborted();if(final)return true;
 }
 throw Error('Search ended without final results.');
}
