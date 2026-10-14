export const emptyAdminDrafts=()=>Object.fromEntries(['weather-policy-form','motd-list-form','motd-override-form','motd-rotate-form','routing-form','policy-form','drain-form','probe-form','quality-decision-form','quality-rule-form'].map(id=>[id,false]));
export function updateDrafts({drafts,id,values,remove=false,reset=false,budget=[]}){if(reset)return emptyAdminDrafts();if(!Object.hasOwn(emptyAdminDrafts(),id))throw Error('Unknown admin form');const next={...emptyAdminDrafts(),...drafts};if(remove)next[id]=false;else next[id]={...values,...(id==='weather-policy-form'?{budget:budget.map(row=>({...row,value:values[row.id]??row.value}))}:{})};return next;}
export function adminFeedback(current,item){return {...current,items:item.dismiss?current.items.filter(row=>row.id!==item.id):[...current.items,item]};}
export function feedbackModel({current,change}){
 if(change.dismiss)return {...current,items:current.items.filter(item=>item.id!==change.id)};
 const item={...change,id:change.id||'admin-notice-'+crypto.randomUUID(),title:change.title||(change.type==='error'?'Aktion nicht bestätigt':'Gespeichert'),duration:change.type==='error'?'0':'6000'};
 return {...current,items:[...current.items,item]};
}
export async function saveAdminForm({serviceId,payload},{signal,invokeServer,project,announce,setBusy,notify}){
 signal.throwIfAborted();await setBusy(true);
 try{
  const result=await invokeServer(serviceId,payload,signal);signal.throwIfAborted();
  await project(result);
  if(serviceId==='admin.motd.set')notify?.();
  await announce(result.notices?.length?result.notices:[{message:result.message||'Änderung und Audit gespeichert.',type:'success'}]);
  return true;
 }catch(error){if(signal.aborted)throw error;await announce([{message:error.message||'Änderung nicht gespeichert. Eingaben bleiben erhalten.',type:'error'}]);return false;}
 finally{await setBusy(false);}
}
export async function resolveAdminGuard({choice,ids},{save,discard}){
 if(choice==='cancel')return false;
 if(choice==='discard'){await discard();return true;}
 if(choice==='save'){for(const id of ids)if(!await save(id))return false;return true;}
 throw Error('Unknown guard choice');
}
