import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
export function installMotd(){
 const transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services'}),registry=createAppServiceRegistry(services,{transport,historyLimit:0});
 let active,epoch=0,disposed=false;
 const home=()=>window.XTendPage?.getRuntime()?.model.getState('search.data')?.view==='home'&&!document.hidden;
 async function refresh(){
  if(disposed||!home()||active)return;const own=epoch;active=new AbortController();
  try{const value=await registry.invoke('search.motd',{}, {},{signal:active.signal,timeoutMs:5000});if(own===epoch&&home())await window.XTendPage.getRuntime().dispatchCommand('search.motd.set',{value});}catch{/* Last rendered/default text remains readable when offline. */}finally{if(own===epoch)active=null;}
 }
 const events=({detail})=>{if(detail.type==='pending'){epoch++;active?.abort();active=null;}if(['ready','navigate'].includes(detail.type))void refresh();};
 window.addEventListener('xtend-page:ready',refresh);window.addEventListener('xtend-page:event',events);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('xtend.search.content'):null;channel?.addEventListener('message',refresh);
 const timer=setInterval(refresh,30000);
 window.addEventListener('pagehide',()=>{disposed=true;epoch++;active?.abort();clearInterval(timer);channel?.close();window.removeEventListener('xtend-page:ready',refresh);window.removeEventListener('xtend-page:event',events);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);registry.dispose();transport.dispose?.();},{once:true});
}
