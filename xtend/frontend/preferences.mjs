import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
// Cookie persistence is a browser-host concern. RMT owns controls and feedback;
// XTend continues to own all search navigation and resumable rendering.
export function installPreferences(command){
 const registry=createAppServiceRegistry(services,{historyLimit:0});let epoch=0,busy=false;
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')epoch++;if(detail.type==='navigate')void command('search.preferences.status',{message:'',busy});});
 document.addEventListener('submit',async event=>{
  if(event.target.getAttribute('id')!=='search-form'||event.submitter?.name!=='preferenceAction')return;
  // If resumption has failed, keep the fully functional native POST fallback.
  if(!window.XTendPage?.getRuntime())return;
  event.preventDefault();event.stopImmediatePropagation();if(busy)return;
  const body=new URLSearchParams(new FormData(event.target));body.set('preferenceAction',event.submitter.value);
  const ownEpoch=epoch;busy=true;
  await command('search.preferences.status',{message:'Wird gespeichert …',busy:true});
  let message;
  try{
   ({message}=await registry.invoke('search.preferences.save',{values:[...body]}, {}, {timeoutMs:16000}));
  }catch{message='Speichern nicht bestätigt. Bitte Cookies für diese Seite zulassen und erneut versuchen. Die aktuelle Suche bleibt nutzbar.';}
  finally{busy=false;await command('search.preferences.status',{message:ownEpoch===epoch?message:'',busy:false});}
 },true);
 window.addEventListener('pagehide',()=>{epoch++;registry.dispose();},{once:true});
}
