// Native details without JS. RMT owns surfaces/state; the host sequences clicks.
export function installFilterMotion(command){
 let generation=0,pendingIntent=null;
 document.addEventListener('click',event=>{
  const summary=event.target.closest?.('#filters>summary');if(!summary||!window.XTendPage?.getRuntime())return;
  event.preventDefault();const details=summary.parentElement,runtime=window.XTendPage.getRuntime(),open=!(pendingIntent??runtime.model.getState('search.filterUi')?.open),own=++generation;
  // Retain only the latest requested command while AnimationEngine interrupts.
  pendingIntent=open;details.open=true;
  void command(open?'search.filters.open':'search.filters.close').then(()=>{if(own===generation){pendingIntent=null;void command('search.filters.settle',{open});}}).catch(()=>{if(own===generation){pendingIntent=null;void command('search.filters.settle',{open:!!runtime.model.getState('search.filterUi')?.open});}});
 },true);
 window.addEventListener('xtend-page:ready',()=>{const details=document.getElementById('filters');if(details)void command('search.filters.init',{open:details.open,hidden:!details.open});});
 window.addEventListener('pagehide',()=>{generation++;pendingIntent=null;});
}
