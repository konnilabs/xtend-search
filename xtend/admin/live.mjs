import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import '@ccslabs/xtend/components/xsurfacemanager.js';
import '@ccslabs/xtend/components/xsidepanel.js';
import '@ccslabs/xtend/components/xdialog.js';
import '@ccslabs/xtend/components/xtoast.js';
import services from './services.ts';
export function watchObservatory(client,csrf){
 const controller=new AbortController(),transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services',headers:{'X-CSRF-Token':csrf}}),registry=createAppServiceRegistry(services,{transport,historyLimit:0});
 const command=(name,payload)=>client.getRuntime().dispatchCommand(name,payload);
 const serviceFor=form=>form.dataset.adminService||({'policy-form':'admin.engine.policy.set','drain-form':'admin.engine.drain','probe-form':'admin.engine.probe.request','routing-form':'admin.routing.mode.set'})[form.getAttribute('id')];
 let readGeneration=0,readController=new AbortController();
 const dirty=new Set();let draftQueue=Promise.resolve();
 const drafts=()=>client.getRuntime().model.getState('admin.drafts')||{};
 const clearDrafts=async()=>command('admin.drafts.set',{value:await registry.invoke('admin.drafts.reduce',{drafts:{},id:'',values:{},reset:true})});
 const updateDraft=(form,remove=false)=>draftQueue=draftQueue.catch(()=>{}).then(async()=>{const value=await registry.invoke('admin.drafts.reduce',{drafts:drafts(),id:form.getAttribute('id'),values:input(form),remove});return command('admin.drafts.set',{value});});let saving=null,guarding=false,guardDecision=null,watchController,connected=true,currentUrl=location.href,historyIndex=Number(history.state?.observatoryIndex)||0,suppressPop=false;
 history.replaceState({...history.state,observatoryIndex:historyIndex},'',location.href);
 const input=form=>{const data={...Object.fromEntries(new URL(location.href).searchParams),...Object.fromEntries(new FormData(form))};for(const box of form.querySelectorAll('input[type=checkbox]'))data[box.name]=box.checked;return data;};
 // Feedback belongs to RMT, separately from live data and form responses.
 // Serialize changes so dismissal and a concurrent save cannot lose notices.
 let feedbackQueue=Promise.resolve();
 function updateFeedback(update){
  const next=feedbackQueue.then(()=>{if(controller.signal.aborted)return;return command('admin.feedback.set',{value:update(client.getRuntime().model.getState('admin.feedback')||{items:[]})});});
  feedbackQueue=next.catch(()=>{});return feedbackQueue;
 }
 function toast(message,type='success',title='',id='admin-notice-'+crypto.randomUUID()){
  return updateFeedback(current=>({items:[...current.items,{id,title:title||(type==='error'?'Aktion nicht bestätigt':'Gespeichert'),message,type,duration:type==='error'?'0':'6000'}]}));
 }
 document.addEventListener('toast-dismissed',event=>{
  if(!event.target.matches('x-toast.admin-toast'))return;
  const id=event.target.id;
  void updateFeedback(current=>({items:current.items.filter(item=>item.id!==id)}));
 },{signal:controller.signal});
 let layoutUpdate=null,geometry='',geometryPanel=null;
 function surfaces(){
  if(controller.signal.aborted)return;
  const manager=document.getElementById('observatory-surfaces'),panel=document.getElementById('source-panel');if(!manager||!panel)return;
  const narrow=matchMedia('(max-width: 900px)').matches;
  const mode=narrow?'fullscreen':'docked';
  if(client.getRuntime().model.getState('admin.layout').mode!==mode){
   if(!layoutUpdate){layoutUpdate=command('admin.layout.set',{value:{mode,modal:narrow}}).then(()=>{layoutUpdate=null;surfaces();},()=>{layoutUpdate=null;});}
   return;
  }
  if(geometryPanel!==panel){geometryPanel=panel;geometry='';}const signature=mode+':'+innerWidth+':'+manager.clientHeight;if(geometry===signature)return;geometry=signature;
  panel.setPanelMode(mode,'right');
  panel.resizePanel({width:narrow?innerWidth:Math.min(680,Math.max(420,innerWidth*.43)),height:manager.clientHeight});
  manager.openSurface('source-detail');manager.dockSurface('source-detail','right',mode);
 }
 new ResizeObserver(surfaces).observe(document.documentElement);
 const observer=new MutationObserver(()=>queueMicrotask(surfaces));
 observer.observe(document.getElementById('xtend-page'),{subtree:true,childList:true});surfaces();
 document.addEventListener('input',event=>{const form=event.target.closest('form');if(form&&serviceFor(form)){dirty.add(form);void updateDraft(form);}},{signal:controller.signal});
 document.addEventListener('change',event=>{const form=event.target.closest('form');if(form&&serviceFor(form)){dirty.add(form);void updateDraft(form);}if(event.target.matches('#pool-filters select'))event.target.form.requestSubmit();},{signal:controller.signal});
 async function save(form){
  if(saving)return saving;
  if(!form.reportValidity())return false;
  const focused=document.activeElement?.name,positions=[...document.querySelectorAll('[data-xtend-scroll]')].map(n=>[n.dataset.xtendScroll,n.scrollLeft,n.scrollTop]);
  saving=(async()=>{await draftQueue;const payload=input(form);await command('admin.busy.set',{value:true});
   try{

    const result=await registry.invoke(serviceFor(form),payload);dirty.delete(form);await updateDraft(form,true);
    await client.optimistic(props=>({...props,'admin.data':result}),async()=>true);

    if(serviceFor(form)==='admin.motd.set'&&typeof BroadcastChannel==='function'){const channel=new BroadcastChannel('xtend.search.content');channel.postMessage({changed:true});channel.close();}
    if(result.notices?.length){for(const notice of result.notices)await toast(notice.message,notice.type,notice.title,notice.id);}
    else await toast(result.message||'Änderung und Audit gespeichert.');
    requestAnimationFrame(()=>{for(const [id,x,y]of positions)document.querySelector('[data-xtend-scroll="'+id+'"]')?.scrollTo(x,y);if(focused)document.getElementById(form.getAttribute('id'))?.elements.namedItem(focused)?.focus({preventScroll:true});surfaces();});
    return true;
   }catch(error){await toast(error.message||'Änderung nicht gespeichert. Eingaben bleiben erhalten.','error');return false;}
   finally{await command('admin.busy.set',{value:false});saving=null;}
  })();return saving;
 }
 async function confirmLeave(){
  for(const form of [...dirty])if(!form.isConnected)dirty.delete(form);
  if(!dirty.size)return true;if(guarding)return false;guarding=true;
  await client.getRuntime().ensureComponent('x-dialog');
  await command('admin.guard.set',{value:true});
  return new Promise(resolve=>{let done=false;const finish=async value=>{if(done)return;done=true;await command('admin.guard.set',{value:false});guarding=false;guardDecision=null;resolve(value);};
   guardDecision=async choice=>{if(choice==='cancel')return finish(false);if(choice==='discard'){dirty.clear();await clearDrafts();return finish(true);}if(choice==='save'){for(const form of [...dirty])if(!await save(form))return finish(false);return finish(true);}};
  });
 }
 document.addEventListener('dialog-closed',event=>{if(event.target.id==='admin-draft-guard'&&guardDecision)void guardDecision('cancel');},{signal:controller.signal});
 document.addEventListener('click',event=>{const choice=event.target.closest?.('#admin-draft-guard [data-choice]')?.dataset.choice;if(choice&&guardDecision){event.preventDefault();void guardDecision(choice);}},{signal:controller.signal});
 document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.action?.endsWith('/admin/logout')){dirty.clear();for(const key of Object.keys(sessionStorage))if(key.startsWith('xtend.search.admin')||key.startsWith('observatory'))sessionStorage.removeItem(key);return;}
  if(serviceFor(form)){event.preventDefault();event.stopImmediatePropagation();void save(form);return;}
  if(form.getAttribute('id')==='pool-filters'&&dirty.size){event.preventDefault();event.stopImmediatePropagation();const url='/admin?'+new URLSearchParams(new FormData(form));void confirmLeave().then(ok=>{if(ok)client.visit(url,{preserveScroll:true});});}
 },{capture:true,signal:controller.signal});
 document.addEventListener('click',event=>{
  if(event.target.closest('#quality-evidence')){event.preventDefault();const own=readGeneration,signal=readController.signal,scope={id:new URL(location.href).searchParams.get('engine'),capability:document.querySelector('[name=capability]')?.value||new URL(location.href).searchParams.get('capability')};
   void command('admin.evidence.set',{value:{rows:[],message:'Belege werden abgerufen …'}}).then(()=>own===readGeneration?registry.invoke('admin.quality.evidence',scope,{},{signal,timeoutMs:10000}):[]).then(rows=>{if(own===readGeneration)return command('admin.evidence.set',{value:{rows:rows.map((row,index)=>({...row,id:String(index),label:row.reason+' · '+row.url})),message:rows.length?'':'Keine freiwilligen Belege vorhanden.'}});}).catch(error=>{if(own===readGeneration){void command('admin.evidence.set',{value:{rows:[],message:'Belege konnten nicht geladen werden.'}});toast(error.message,'error');}});return;}
  if(event.target.closest('#quality-simulate')){event.preventDefault();const own=readGeneration;
   void registry.invoke('admin.quality.simulate',input(document.getElementById('quality-rule-form')),{},{signal:readController.signal,timeoutMs:10000}).then(r=>{if(own===readGeneration)return command('admin.simulation.set',{value:r.count+' Meldungen / '+r.contexts+' Kontexte: Schwelle '+(r.wouldMatch?'erreicht. ':'nicht erreicht. ')+r.message});}).catch(error=>{if(own===readGeneration)toast(error.message,'error');});return;}
  const refresh=event.target.closest('#admin-refresh'),link=event.target.closest('a[href]');if(!refresh&&!link)return;
  if(refresh){event.preventDefault();event.stopImmediatePropagation();void confirmLeave().then(ok=>{if(ok)client.reload({preserveScroll:true});});return;}
  if(!dirty.size||event.button||event.metaKey||event.ctrlKey||event.shiftKey||link.target==='_blank')return;
  event.preventDefault();event.stopImmediatePropagation();void confirmLeave().then(ok=>{if(ok){const url=new URL(link.href);if(url.origin===location.origin&&url.pathname==='/admin')client.visit(url.href,{preserveScroll:true});else location.assign(url.href);}});
 },{capture:true,signal:controller.signal});
 window.addEventListener('popstate',event=>{
  if(suppressPop){event.stopImmediatePropagation();suppressPop=false;return;}
  const targetIndex=Number(event.state?.observatoryIndex)||0,targetUrl=location.href;
  if(!dirty.size){historyIndex=targetIndex;currentUrl=targetUrl;return;}
  event.stopImmediatePropagation();void confirmLeave().then(ok=>{if(ok){historyIndex=targetIndex;currentUrl=targetUrl;client.visit(targetUrl,{fromHistory:true,preserveScroll:true});}else{const delta=historyIndex-targetIndex;if(delta){suppressPop=true;history.go(delta);}else history.replaceState({...history.state,observatoryIndex:historyIndex},'',currentUrl);}});
 },{capture:true,signal:controller.signal});
 window.addEventListener('beforeunload',event=>{if(dirty.size){event.preventDefault();event.returnValue='';}},{signal:controller.signal});
 const stop=client.subscribe(event=>{if(event.type==='pending'){readGeneration++;readController.abort();readController=new AbortController();void command('admin.evidence.set',{value:{rows:[],message:''}}).catch(()=>{});void command('admin.simulation.set',{value:''}).catch(()=>{});}if(event.type==='navigate'){const navigated=location.href!==currentUrl;currentUrl=location.href;if(history.state?.observatoryIndex===undefined)historyIndex++;history.replaceState({...history.state,observatoryIndex:historyIndex},'',location.href);if(navigated){dirty.clear();void clearDrafts();watchController?.abort();}surfaces();}});
 async function watch(){while(!controller.signal.aborted){watchController=new AbortController();try{
  const watchUrl=location.href,params=Object.fromEntries(new URL(watchUrl).searchParams);params.id=params.engine;
  const frames=registry.stream('admin.observatory.events',params,{}, {signal:AbortSignal.any([controller.signal,watchController.signal]),timeoutMs:30000});
  for await(const frame of frames){if(controller.signal.aborted)return;if(watchController.signal.aborted||location.href!==watchUrl)break;if(frame.type==='error'||frame.type==='cancelled')throw Error('connection');if(frame.value?.view){await command('admin.live.set',{value:frame.value.view});await command('admin.connection.set',{message:'Live verbunden · '+frame.value.view.updated});}}
 }catch{if(!controller.signal.aborted&&!watchController.signal.aborted)await command('admin.connection.set',{message:'Live-Verbindung unterbrochen. Angezeigte Daten können veraltet sein.'}).catch(()=>{});}
 if(!controller.signal.aborted&&!watchController.signal.aborted)await new Promise(resolve=>setTimeout(resolve,3000));}}
 void watch();window.addEventListener('pagehide',()=>{readGeneration++;controller.abort();readController.abort();stop();observer.disconnect();registry.dispose();transport.dispose?.();},{once:true});
}
