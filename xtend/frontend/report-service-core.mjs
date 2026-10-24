import {createAppServiceRegistry,createHttpAppServiceTransport,defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
import {emptyReport,decoratedReportData} from './report-state.mjs';
export function reduceReport({previous,patch,data}){
 const feedback={...previous,...patch};feedback.canSave=!!feedback.selected?.length&&!!feedback.reason&&!feedback.busy;
 feedback.selectedKeys=feedback.selected.map(row=>row.id);
 feedback.countLabel=feedback.selected.length?`${feedback.selected.length} von 5 Ergebnissen ausgewählt`:'Bitte bis zu fünf Ergebnisse auswählen.';
 const decorated=decoratedReportData(data,feedback);return {feedback,results:decorated.results,cards:decorated.knowledgeCards};
}
// Read the serialized Action Model, never a controller's queued result snapshot.
// Selection is separate from provider data; RMT derives all visible checks from it.
export function applyReportAction({value},context){
 const reader=context?.stateRuntime;if(typeof reader?.getState!=='function')throw Error('Report action requires the Maraca Action Model reader');
 const data=reader.getState('search.data'),previous=reader.getState('search.feedback');
 const patch=value.selection?selectReport({feedback:previous,data,...value.selection}):value.patch;
 return {feedback:reduceReport({previous,patch,data}).feedback};
}
export function selectReport({feedback,data,id,checked}){
 if(feedback.busy)return {};
 const row=[...(data.results||[]),...(data.knowledgeCards||[])].find(row=>row.reportKey===id);if(!row?.reportTicket)return {};
 const selected=feedback.selected.filter(row=>row.id!==id);
 if(checked){if(selected.length>=5)return {error:'Bitte höchstens fünf Ergebnisse auswählen.'};selected.push({id:row.reportKey,url:row.url||row.links?.[0]?.url||'',label:row.title});}
 return {selected,error:''};
}
export const reportIsDirty=feedback=>!!(feedback.open&&(feedback.selected.length||feedback.reason||feedback.includeUrl));
export async function submitReport({feedback,data,requestKey},{signal},fetchProof=fetch){
 const rows=[...(data.results||[]),...(data.knowledgeCards||[])],tickets=feedback.selected.map(item=>rows.find(row=>row.reportKey===item.id)?.reportTicket);
 if(!tickets.length||tickets.length>5||tickets.some(ticket=>!ticket))throw Error('Die Auswahl ist nicht mehr verfügbar. Bitte erneut auswählen.');
 const params=new URLSearchParams();tickets.forEach(ticket=>params.append('ticket',ticket));
 const response=await fetchProof('/feedback/batch?'+params,{headers:{Accept:'application/json'},credentials:'same-origin',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
 if(!response.ok)throw Error('Ergebnisnachweise sind abgelaufen oder nicht verfügbar. Bitte die Suche erneut starten.');
 const context=await response.json();signal.throwIfAborted();
 const transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services',headers:{'X-CSRF-Token':context.csrf}});
 const registry=createAppServiceRegistry(defineAppServices({'search.feedback.batch.submit':service({kind:'command',target:'server'})}),{transport,historyLimit:0});
 try{return await registry.invoke('search.feedback.batch.submit',{tickets,reason:feedback.reason,includeUrl:feedback.includeUrl,requestKey},{},{signal,timeoutMs:10000});}finally{registry.dispose();transport.dispose?.();}
}
