import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
// One serial Model port shared by About and media. It prevents concurrent
// reducers from projecting stale full-overlay snapshots over one another.
const registry=createAppServiceRegistry(services,{historyLimit:0});let queue=Promise.resolve(),disposed=false;
export function updateOverlay(patch,isCurrent=()=>true){
 queue=queue.catch(()=>{}).then(async()=>{
  const runtime=window.XTendPage?.getRuntime();if(disposed||!runtime||!isCurrent())return;
  const value=await registry.invoke('search.overlay.reduce',{current:runtime.model.getState('search.overlay'),patch});
  if(!disposed&&isCurrent())await runtime.dispatchCommand('search.overlay.set',{value});
 });return queue.catch(error=>{if(!disposed)throw error;});
}
window.addEventListener('pagehide',()=>{disposed=true;registry.dispose();},{once:true});
