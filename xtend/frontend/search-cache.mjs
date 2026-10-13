import {createAppServiceRegistry,createHttpAppServiceTransport} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {clearSearchResources,searchCacheStats} from './cache-service-core.mjs';
export function createSearchResourcePolicy(){
 const transport=createHttpAppServiceTransport({pathPrefix:'/api/xtend/services'}),registry=createAppServiceRegistry(services,{transport,historyLimit:0});let disposed=false;
 const scope=page=>({version:page.version,contextKey:page.contextKey});
 const cacheContextQuery=(signal,weather)=>registry.invoke(weather?'search.weather.cache.context':'search.cache.context',{}, {},{signal,timeoutMs:3000});
 const capture=page=>{
  if(disposed||!page.props?.['search.data']?.cache?.enabled)return;
  void registry.invoke('search.cache.capture',{data:page.props['search.data'],scope:scope(page)}).catch(()=>{});
 };
 const ready=({detail})=>capture(detail.client.page);
 const changed=({detail})=>{if(detail.type==='navigate')capture(detail.page);};
 window.addEventListener('xtend-page:ready',ready);window.addEventListener('xtend-page:event',changed);
 window.addEventListener('pagehide',()=>{disposed=true;registry.dispose();transport.dispose();clearSearchResources();window.removeEventListener('xtend-page:ready',ready);window.removeEventListener('xtend-page:event',changed);},{once:true});
 // Counts only, for runtime budgets and browser acceptance; never result keys.
 window.XTendSearchCacheStats=searchCacheStats;
 return {
  async resolve(url,context){
   const target=new URL(url);if(!['/','/search'].includes(target.pathname)||context.page.page!=='Search')return null;
   if(context.cache==='reload'){await registry.invoke('search.cache.invalidate',{url,scope:scope(context.page)}, {},{signal:context.signal});return null;}
   return registry.invoke('search.cache.restore',{url,scope:scope(context.page)},{cacheContextQuery},{signal:context.signal,timeoutMs:3500});
  },
  project(resource,{page}){
   const {ssr,csrfToken,...shell}=page,identity=resource.identity;
   return {...shell,url:resource.requestUrl,props:{...page.props,'search.data':resource.data,'search.query':identity.q,'search.filters':{language:identity.language,timeRange:identity.timeRange,safeSearch:identity.safeSearch}},head:[...page.head.filter(h=>h.tag!=='title'),{tag:'title',text:`${identity.q} · XTend.search`}],partial:false,once:{},merge:{},deferred:{},errors:{},flash:{}};
  },
  clear(){clearSearchResources();}
 };
}
