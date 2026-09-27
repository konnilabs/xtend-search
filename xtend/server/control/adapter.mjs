import {createHash} from 'node:crypto';
import {fail,key,validateQuery,allowedUrl,plain,retryAfter,MODES} from './contracts.mjs';
import {catalogLanguages} from './locales.mjs';
export const PINNED='2026.9.19+e831fc2a1';
export async function jsonResponse(response,limit=2097152){
 if(!response.headers.get('content-type')?.includes('json'))throw new Error('schema_invalid');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('schema_invalid');parts.push(value);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}finally{await reader.cancel().catch(()=>{});}
}
export class SearxAdapter {
 constructor({baseUrl,token,fetchImpl=fetch}){this.base=new URL(baseUrl);if(!['http:','https:'].includes(this.base.protocol)||this.base.username||this.base.password)throw new Error('Invalid backend URL');if(!token)throw new Error('SEARXNG_TOKEN required');this.token=token;this.fetch=fetchImpl;this.catalog=new Map();this.status='unknown';this.lastRefresh=0;}
 async discover(){
  try{
   const r=await this.fetch(new URL('config',this.base),{headers:{Authorization:`Bearer ${this.token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(5000)});
   if(!r.ok)throw new Error('backend_unavailable');if(r.headers.get('x-xtend-backend-contract')!=='engine-json-v1')throw new Error('incompatible');const raw=await jsonResponse(r);
   if(typeof raw.version!=='string'||!raw.version.startsWith(PINNED)||!Array.isArray(raw.engines)||raw.engines.length>600||!Array.isArray(raw.plugins)||raw.plugins.some(p=>p.enabled))throw new Error('incompatible');
   const catalog=new Map();
   for(const e of raw.engines){
    key(e.name);if(catalog.has(e.name)||!Array.isArray(e.categories)||!['paging','language_support','safesearch','time_range_support'].every(k=>typeof e[k]==='boolean'))throw new Error('incompatible');
    const capabilities=e.categories.filter(c=>MODES.includes(c));
    // Explicit adapters reviewed against the pinned upstream engine modules.
    if(['wikipedia','wikidata'].includes(e.name))capabilities.push('knowledge');
    const record={id:e.name,capabilities:[...new Set(capabilities)],paging:e.paging,safeSearch:e.safesearch,language:e.language_support,languages:Array.isArray(e.languages)?e.languages.filter(x=>typeof x==='string').slice(0,300):[],timeRange:e.time_range_support,timeout:Math.min(10000,Math.max(1000,Number(e.timeout)*1000||10000)),enabled:e.enabled===true,knowledge:['wikipedia','wikidata'].includes(e.name)};
    const legacyLocaleFingerprint=createHash('sha256').update(JSON.stringify(record)).digest('hex');
    record.languages=catalogLanguages(e.languages,e.regions);
    record.fingerprint=createHash('sha256').update(JSON.stringify(record)).digest('hex');
    // Available only to the explicit maintenance tool, not serialized or used
    // as an alternative approval by the control plane.
    Object.defineProperty(record,'legacyLocaleFingerprint',{value:legacyLocaleFingerprint});
    catalog.set(e.name,Object.freeze(record));
   }
   this.faviconContract=r.headers.get('x-xtend-favicon-contract')==='favicon-v1';this.catalog=catalog;this.version=raw.version;this.status='compatible';this.lastRefresh=Date.now();return catalog;
  }catch(e){this.status=e.message==='incompatible'?'incompatible':'unavailable';throw new Error(this.status);}
 }
 async execute(engine,state,signal){
  validateQuery(state.q);if(this.status!=='compatible'||Date.now()-this.lastRefresh>600000||!this.catalog.has(engine.id))fail('backend','Der Suchkern ist nicht freigegeben.');
  // No categories, cookies, user engine choices, plugins, timeout or engine_data.
  const body=new URLSearchParams({q:state.q,engines:engine.id,format:'json',language:state.language,safesearch:String(state.safeSearch),time_range:state.timeRange,pageno:String(state.page)});
  const start=performance.now();
  try{
   const r=await this.fetch(new URL('search',this.base),{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body,redirect:'error',signal});
   if(!r.ok)return {outcome:'error',errorClass:r.status===429?'backend_ingress_limit':'backend_unavailable',retryNotBefore:retryAfter(r.headers.get('retry-after')),durationMs:performance.now()-start,results:[],infoboxes:[]};
   const raw=await jsonResponse(r);if(!raw||!Array.isArray(raw.results)||raw.results.length>1000||!Array.isArray(raw.unresponsive_engines))throw new Error('schema_invalid');
   const errors=raw.unresponsive_engines;
   if(errors.length){
    const error=errors.find(x=>Array.isArray(x)&&x[0]===engine.id);if(!error)throw new Error('schema_invalid');
    const code=String(error[1]||'').toLowerCase();const errorClass=code.includes('captcha')?'captcha':code.includes('toomany')||code.includes('rate')?'rate_limit':code.includes('accessdenied')||code.includes('forbidden')?'access_denied':code.includes('timeout')?'timeout':'unknown';
    return {outcome:'error',errorClass,backendSuspendedUntil:null,durationMs:performance.now()-start,results:[],infoboxes:[]};
   }
   for(const r of raw.results){if(!r||typeof r!=='object'||!allowedUrl(r.url))throw new Error('unsafe_url_scheme');const names=r.engines || [r.engine];if(!Array.isArray(names)||names.some(n=>n!==engine.id))throw new Error('schema_invalid');if(state.category==='images'&&!allowedUrl(r.img_src))throw new Error('wrong_result_type');}
   return {outcome:raw.results.length||raw.infoboxes?.length?'success':'empty',errorClass:null,results:raw.results.slice(0,100).map(r=>({...r,title:plain(r.title,300),content:plain(r.content)})),infoboxes:Array.isArray(raw.infoboxes)?raw.infoboxes.slice(0,3):[],durationMs:performance.now()-start};
  }catch(e){return {outcome:signal.aborted?'cancelled':'error',errorClass:signal.aborted?'timeout':['schema_invalid','wrong_result_type','unsafe_url_scheme'].includes(e.message)?e.message:'backend_unavailable',durationMs:performance.now()-start,results:[],infoboxes:[]};}
 }
}
