import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {faviconResources} from './favicon-service-core.mjs';
// This adapter only reads viewport demand and publishes service results to RMT.
export function installFavicons(){
 const registry=createAppServiceRegistry(services,{historyLimit:0});let epoch=0,active=0,scheduled=false,commits=Promise.resolve(),observed=new WeakSet();const queue=[],queued=new Set(),controllers=new Set();
 const runtime=()=>window.XTendPage?.getRuntime(),visible=()=>document.querySelectorAll('[data-favicon]');
 const paint=own=>commits=commits.catch(()=>{}).then(async()=>{if(own!==epoch||!runtime())return;const value=await registry.invoke('search.favicons.project',{results:runtime().model.getState('search.data').results});if(own===epoch)await runtime().dispatchCommand('search.images.set',{value});});
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);const src=entry.target.dataset.favicon;if(src&&!queued.has(src)){queued.add(src);queue.push(src);}}pump();},{rootMargin:'100px'});
 function scan(){for(const node of visible()){const src=node.dataset.favicon;if(!src)continue;if(faviconResources.get(src)){void paint(epoch);continue;}if(!observed.has(node)){observed.add(node);observer.observe(node);}}}
 function pump(){while(active<2&&queue.length){const src=queue.shift(),own=epoch,c=new AbortController();controllers.add(c);active++;void registry.invoke('search.favicons.load',{src},{},{signal:c.signal}).then(value=>{if(value&&own===epoch)return paint(own);}).catch(()=>{}).finally(()=>{controllers.delete(c);active--;pump();});}}
 function schedule(){if(!runtime()||scheduled)return;scheduled=true;const done=()=>{scheduled=false;scan();};const scheduler=runtime().getScheduler?.();if(scheduler)scheduler.schedule({lane:'background',priority:5,strategy:'after_paint',coalesceKey:'search-favicons',endpointName:'search.favicons',scope:'search'},done).catch(()=>{scheduled=false;});else requestAnimationFrame(()=>requestAnimationFrame(done));}
 function reset(){epoch++;for(const c of controllers)c.abort();queue.length=0;queued.clear();observer.disconnect();observed=new WeakSet();scheduled=false;}
 window.addEventListener('xtend-page:ready',schedule);window.addEventListener('xtend-search:stream',schedule);
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')reset();if(detail.type==='navigate')schedule();});
 const mutation=new MutationObserver(schedule);mutation.observe(document.getElementById('xtend-page')||document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>{reset();mutation.disconnect();registry.dispose();faviconResources.dispose();},{once:true});schedule();
}
