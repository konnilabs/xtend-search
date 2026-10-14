export function evidenceModel(rows){return {rows:rows.map((row,index)=>({...row,id:String(index),label:row.reason+' · '+row.url})),message:rows.length?'':'Keine freiwilligen Belege vorhanden.'};}
export async function observeAdmin(_input,{signal,current,openFrames,present,pause}){
 while(!signal.aborted){
  const scope=current();if(!scope)return;
  try{
   for await(const frame of openFrames(scope,signal)){
    signal.throwIfAborted();if(current()?.url!==scope.url)break;
    if(['error','cancelled'].includes(frame.type))throw Error('connection');
    if(frame.value?.view)await present({value:frame.value.view,message:'Live verbunden · '+frame.value.view.updated},scope);
   }
  }catch(error){if(signal.aborted)throw error;if(current()?.url===scope.url)await present({message:'Live-Verbindung unterbrochen. Angezeigte Daten können veraltet sein.'},scope);}
  if(!signal.aborted)await pause(3000,signal);
 }
}
export function pauseObservation(ms,signal){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);const abort=()=>{clearTimeout(timer);reject(signal.reason||new DOMException('Aborted','AbortError'));};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});}
