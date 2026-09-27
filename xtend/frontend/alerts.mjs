// The Classic component owns its shadow DOM; RMT owns the current warning list.
export function installSearchAlerts(command){
 let currentData=null,pending=false,streamId=null;
 const dismissed=new Set();
 const data=()=>window.XTendPage?.page?.props?.['search.data'];
 // Classic 0.8.0 schedules focus on its root after alert-shown. Inline notices
 // are live regions, not focus destinations; retain the native close button.
 document.addEventListener('alert-shown',event=>{
  if(event.target.matches?.('x-alert.search-warning'))event.target.shadowRoot?.querySelector('[part~="root"]')?.removeAttribute('tabindex');
 });
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending')pending=true;
  if(event.type==='navigate'){
   pending=false;currentData=data();
   const nextStream=currentData?.stream?.id;
   if(!nextStream || nextStream!==streamId)dismissed.clear();
   streamId=nextStream;
   // Maraca skips equal page props on same-query submissions. Reset explicitly.
   void command('search.alerts.set',{value:{warnings:(currentData?.warnings || []).filter(warning=>!dismissed.has(warning.id))}});
  }
  if(event.type==='error')pending=false;
 });
 document.addEventListener('alert-dismissed',async event=>{
  const alert=event.target;
  if(!alert.matches?.('x-alert.search-warning') || !event.detail?.dismissed)return;
  const response=data();if(!response || pending)return;
  if(currentData!==response){currentData=response;dismissed.clear();}
  const id=alert.dataset.warningId;
  if(!response.warnings.some(warning=>warning.id===id))return;
  const hadFocus=document.activeElement===alert;
  const remaining=Array.from(document.querySelectorAll('x-alert.search-warning')).filter(node=>node!==alert);
  const next=remaining.find(node=>alert.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING) || remaining.at(-1);
  dismissed.add(id);
  await command('search.alerts.set',{value:{warnings:response.warnings.filter(warning=>!dismissed.has(warning.id))}});
  if(!hadFocus || pending || data()!==response || (document.activeElement!==document.body && document.activeElement!==alert))return;
  const nextAlert=next && document.getElementById(next.id);
  (nextAlert?.shadowRoot?.querySelector('button[part~="close"]') || document.getElementById('results-heading'))?.focus({preventScroll:true});
 });
}
