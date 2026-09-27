// Lazy host adapter. Existing anchors remain the no-JS / failed-resume fallback.
export function installAbout(){
 let loading=null,dialog=null,epoch=0;
 const reset=()=>{epoch++;dialog?.close();};
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')reset();});
 window.addEventListener('pagehide',reset);
 document.addEventListener('click',async event=>{
  const link=event.target.closest?.('a[data-about-link]');
  if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!window.XTendPage?.getRuntime())return;
  event.preventDefault();event.stopImmediatePropagation();if(loading)return;
  const own=epoch;
  try{
   if(!dialog){
    loading=import('./about-dialog.mjs').then(m=>m.createAboutDialog());
    dialog=await loading;
   }
   if(own===epoch&&link.isConnected)dialog.open(link);
  }catch{if(own===epoch)location.assign(link.href);}
  finally{loading=null;}
 },true);
}
