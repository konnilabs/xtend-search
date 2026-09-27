// Cookie persistence is a browser-host concern. RMT owns controls and feedback;
// XTend continues to own all search navigation and resumable rendering.
export function installPreferences(command){
 let epoch=0,busy=false;
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
   const response=await fetch('/preferences',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json'},body,signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw new Error('save');
   const check=await fetch('/preferences',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!check.ok)throw new Error('verify');const {preferences}=await check.json();
   const cleared=body.get('preferenceAction')==='delete';
   if(cleared?preferences!==null:!['language','time_range','safesearch'].every(key=>preferences?.[key]===body.get(key)))throw new Error('cookie blocked');
   message=cleared?'Gespeicherter Standard gelöscht. Die aktuelle Suche bleibt unverändert.':'Standard für diesen Browser gespeichert.';
  }catch{message='Speichern nicht bestätigt. Bitte Cookies für diese Seite zulassen und erneut versuchen. Die aktuelle Suche bleibt nutzbar.';}
  finally{busy=false;await command('search.preferences.status',{message:ownEpoch===epoch?message:'',busy:false});}
 },true);
}
