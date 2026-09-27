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
 const dirty=new Set();let saving=null,guarding=false,watchController,connected=true,currentUrl=location.href,historyIndex=Number(history.state?.observatoryIndex)||0,suppressPop=false;
 history.replaceState({...history.state,observatoryIndex:historyIndex},'',location.href);
 const input=form=>{const data={...Object.fromEntries(new URL(location.href).searchParams),...Object.fromEntries(new FormData(form))};for(const box of form.querySelectorAll('input[type=checkbox]'))data[box.name]=box.checked;return data;};
 function toast(message,type='success'){const box=document.createElement('x-toast');box.className='admin-toast';box.setAttribute('type',type);box.setAttribute('duration',type==='error'?'0':'6000');box.textContent=message;let region=document.querySelector('.admin-toasts');(region||document.body).append(box);box.addEventListener('toast-dismissed',()=>box.remove(),{once:true});}
 function surfaces(){
  const manager=document.getElementById('observatory-surfaces'),panel=document.getElementById('source-panel');if(!manager||!panel)return;
  const narrow=matchMedia('(max-width: 900px)').matches;
  const mode=narrow?'fullscreen':'docked';
  const signature=mode+':'+innerWidth+':'+manager.clientHeight;if(panel.dataset.geometry===signature)return;panel.dataset.geometry=signature;
  panel.toggleAttribute('modal',narrow);panel.setPanelMode(mode,'right');
  panel.resizePanel({width:narrow?innerWidth:Math.min(680,Math.max(420,innerWidth*.43)),height:manager.clientHeight});
  manager.openSurface('source-detail');manager.dockSurface('source-detail','right',mode);
 }
 new ResizeObserver(surfaces).observe(document.documentElement);
 const observer=new MutationObserver(()=>{const panel=document.getElementById('source-panel');if(panel&&!panel.dataset.hostReady){panel.dataset.hostReady='true';queueMicrotask(surfaces);}});
 observer.observe(document.getElementById('xtend-page'),{subtree:true,childList:true});surfaces();
 document.addEventListener('input',event=>{const form=event.target.closest('form');if(form&&serviceFor(form))dirty.add(form);},{signal:controller.signal});
 document.addEventListener('change',event=>{const form=event.target.closest('form');if(form&&serviceFor(form))dirty.add(form);if(event.target.matches('#pool-filters select'))event.target.form.requestSubmit();},{signal:controller.signal});
 async function save(form){
  if(saving)return saving;
  if(!form.reportValidity())return false;
  const focused=document.activeElement?.name,positions=[...document.querySelectorAll('[data-xtend-scroll]')].map(n=>[n.dataset.xtendScroll,n.scrollLeft,n.scrollTop]);
  saving=(async()=>{const buttons=[...form.querySelectorAll('button[type=submit],button:not([type])')];buttons.forEach(b=>b.disabled=true);
   try{
    const otherDrafts=[...dirty].filter(f=>f!==form&&f.isConnected).map(f=>({id:f.getAttribute('id'),values:input(f)}));
    const result=await registry.invoke(serviceFor(form),input(form));dirty.delete(form);
    await client.optimistic(props=>({...props,'admin.data':result}),async()=>true);
    for(const draft of otherDrafts){const target=document.getElementById(draft.id);if(!target)continue;for(const field of target.querySelectorAll('input:not([type=hidden]),select'))if(Object.hasOwn(draft.values,field.name)){if(field.type==='checkbox')field.checked=draft.values[field.name];else field.value=draft.values[field.name];}dirty.add(target);}
    toast(result.message||'Änderung und Audit gespeichert.');
    requestAnimationFrame(()=>{for(const [id,x,y]of positions)document.querySelector('[data-xtend-scroll="'+id+'"]')?.scrollTo(x,y);if(focused)document.getElementById(form.getAttribute('id'))?.elements.namedItem(focused)?.focus({preventScroll:true});surfaces();});
    return true;
   }catch(error){toast(error.message||'Änderung nicht gespeichert. Eingaben bleiben erhalten.','error');return false;}
   finally{buttons.forEach(b=>b.disabled=false);saving=null;}
  })();return saving;
 }
 async function confirmLeave(){
  for(const form of [...dirty])if(!form.isConnected)dirty.delete(form);
  if(!dirty.size)return true;if(guarding)return false;guarding=true;
  await customElements.whenDefined('x-dialog');
  const dialog=document.createElement('x-dialog');dialog.setAttribute('overlay','');dialog.setAttribute('title','Ungespeicherte Änderungen');dialog.setAttribute('width','min(520px, calc(100vw - 24px))');
  dialog.innerHTML='<p>Die Eingaben sind noch nicht gespeichert.</p><div class="draft-actions"><button data-choice="save">Speichern</button><button data-choice="discard">Verwerfen</button><button data-choice="cancel">Abbrechen</button></div>';
  document.body.append(dialog);
  return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;dialog.close();dialog.remove();guarding=false;resolve(value);};
   dialog.addEventListener('click',async e=>{const choice=e.target.dataset.choice;if(choice==='cancel')finish(false);if(choice==='discard'){dirty.clear();finish(true);}if(choice==='save'){for(const form of [...dirty])if(!await save(form)){finish(false);return;}finish(true);}});
   dialog.addEventListener('dialog-closed',()=>finish(false));dialog.open();
  });
 }
 document.addEventListener('submit',event=>{
  const form=event.target;
  if(form.action?.endsWith('/admin/logout')){dirty.clear();for(const key of Object.keys(sessionStorage))if(key.startsWith('xtend.search.admin')||key.startsWith('observatory'))sessionStorage.removeItem(key);return;}
  if(serviceFor(form)){event.preventDefault();event.stopImmediatePropagation();void save(form);return;}
  if(form.getAttribute('id')==='pool-filters'&&dirty.size){event.preventDefault();event.stopImmediatePropagation();const url='/admin?'+new URLSearchParams(new FormData(form));void confirmLeave().then(ok=>{if(ok)client.visit(url,{preserveScroll:true});});}
 },{capture:true,signal:controller.signal});
 document.addEventListener('click',event=>{
  if(event.target.closest('#quality-evidence')){event.preventDefault();void registry.invoke('admin.quality.evidence',{id:new URL(location.href).searchParams.get('engine'),capability:document.querySelector('[name=capability]')?.value||new URL(location.href).searchParams.get('capability')}).then(rows=>{const box=document.getElementById('quality-evidence-list');box.replaceChildren();if(!rows.length)box.textContent='Keine freiwilligen Belege vorhanden.';for(const row of rows){const a=document.createElement('a');a.href=row.url;a.textContent=row.reason+' · '+row.url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('data-xtend-native','');box.append(a);}}).catch(error=>toast(error.message,'error'));return;}
  if(event.target.closest('#quality-simulate')){event.preventDefault();void registry.invoke('admin.quality.simulate',input(document.getElementById('quality-rule-form'))).then(r=>{document.getElementById('quality-simulation').textContent=r.count+' Meldungen / '+r.contexts+' Kontexte: Schwelle '+(r.wouldMatch?'erreicht. ':'nicht erreicht. ')+r.message;}).catch(error=>toast(error.message,'error'));return;}
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
 const stop=client.subscribe(event=>{if(event.type==='navigate'){currentUrl=location.href;if(history.state?.observatoryIndex===undefined)historyIndex++;history.replaceState({...history.state,observatoryIndex:historyIndex},'',location.href);dirty.clear();watchController?.abort();surfaces();}});
 async function watch(){while(!controller.signal.aborted){watchController=new AbortController();try{
  const watchUrl=location.href,params=Object.fromEntries(new URL(watchUrl).searchParams);params.id=params.engine;
  const frames=registry.stream('admin.observatory.events',params,{}, {signal:AbortSignal.any([controller.signal,watchController.signal]),timeoutMs:30000});
  for await(const frame of frames){if(controller.signal.aborted)return;if(watchController.signal.aborted||location.href!==watchUrl)break;if(frame.type==='error'||frame.type==='cancelled')throw Error('connection');if(frame.value?.view){await command('admin.live.set',{value:frame.value.view});await command('admin.connection.set',{message:'Live verbunden · '+frame.value.view.updated});}}
 }catch{if(!controller.signal.aborted&&!watchController.signal.aborted)await command('admin.connection.set',{message:'Live-Verbindung unterbrochen. Angezeigte Daten können veraltet sein.'}).catch(()=>{});}
 if(!controller.signal.aborted&&!watchController.signal.aborted)await new Promise(resolve=>setTimeout(resolve,3000));}}
 void watch();window.addEventListener('pagehide',()=>{controller.abort();stop();observer.disconnect();registry.dispose();transport.dispose?.();},{once:true});
}
