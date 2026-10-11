import {createHash} from 'node:crypto';
import {fail,key,validateQuery,allowedUrl,plain,retryAfter,MODES} from './contracts.mjs';
import {knowledgeAdapter} from './knowledge.mjs';
import {catalogLanguages} from './locales.mjs';
export const PINNED='2026.10.9+9f042d2f6';
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
    const knowledge=knowledgeAdapter(e.name);if(knowledge)capabilities.push('knowledge');
    const record={id:e.name,capabilities:[...new Set(capabilities)],paging:e.paging,safeSearch:e.safesearch,language:e.language_support,languages:Array.isArray(e.languages)?e.languages.filter(x=>typeof x==='string').slice(0,300):[],timeRange:e.time_range_support,timeout:Math.min(10000,Math.max(1000,Number(e.timeout)*1000||10000)),enabled:e.enabled===true,knowledge:!!knowledge};
    const legacyLocaleFingerprint=createHash('sha256').update(JSON.stringify(record)).digest('hex');
    record.languages=catalogLanguages(e.languages,e.regions);
    record.fingerprint=createHash('sha256').update(JSON.stringify(record)).digest('hex');
    // Available only to the explicit maintenance tool, not serialized or used
    // as an alternative approval by the control plane.
    Object.defineProperty(record,'legacyLocaleFingerprint',{value:legacyLocaleFingerprint});
    if(knowledge?.language==='english'){record.knowledgeLanguage='english';record.knowledgeLanguageNotice=knowledge.languageNotice;record.fingerprint=createHash('sha256').update(JSON.stringify(record)).digest('hex');}
    catalog.set(e.name,Object.freeze(record));
   }
   this.healthContract=r.headers.get('x-xtend-engine-health-contract')==='engine-health-v1';this.instanceId=r.headers.get('x-xtend-backend-instance')||'legacy';this.nativeScopes=new Map();
   if(this.healthContract&&raw.xtend_engine_health?.schema==='xtend.engine-health.v1'&&Array.isArray(raw.xtend_engine_health.engines))for(const row of raw.xtend_engine_health.engines){if(!catalog.has(row.id)||!/^[a-f0-9]{32}$/.test(row.scope))throw new Error('incompatible');this.nativeScopes.set(row.id,row.scope);}
   this.faviconContract=r.headers.get('x-xtend-favicon-contract')==='favicon-v1';this.catalog=catalog;this.version=raw.version;this.status='compatible';this.lastRefresh=Date.now();return catalog;
  }catch(e){this.status=e.message==='incompatible'?'incompatible':'unavailable';throw new Error(this.status);}
 }
 async health(ids=[],signal){
  if(!this.healthContract)return null;
  if(!Array.isArray(ids)||ids.length>16||new Set(ids).size!==ids.length||ids.some(id=>!this.catalog.has(id)))throw new Error('schema_invalid');
  const url=new URL('xtend/engine-health',this.base);for(const id of ids)url.searchParams.append('engine',id);
  const r=await this.fetch(url,{headers:{Authorization:`Bearer ${this.token}`,Accept:'application/json'},redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(2000)]):AbortSignal.timeout(2000)});
  if(!r.ok||r.headers.get('x-xtend-engine-health-contract')!=='engine-health-v1')throw new Error('backend_unavailable');const raw=await jsonResponse(r,65536);
  if(raw.schema!=='xtend.engine-health.v1'||!/^[-a-zA-Z0-9]{1,80}$/.test(raw.instanceId)||!Array.isArray(raw.engines)||raw.engines.length!==ids.length)throw new Error('schema_invalid');
  for(const row of raw.engines)if(!ids.includes(row.id)||!/^[a-f0-9]{32}$/.test(row.scope)||!Number.isSafeInteger(row.remainingMs)||row.remainingMs<0||row.remainingMs>8640000000000000-Date.now()||![null,'captcha','rate_limit','access_denied','timeout','unknown'].includes(row.errorClass))throw new Error('schema_invalid');
  if(new Set(raw.engines.map(e=>e.id)).size!==ids.length)throw new Error('schema_invalid');this.instanceId=raw.instanceId;for(const row of raw.engines)this.nativeScopes?.set(row.id,row.scope);return raw;
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
    let nativeHealth=null;try{nativeHealth=(await this.health([engine.id],signal))?.engines[0]||null;}catch{}
    return {outcome:'error',errorClass,backendSuspendedUntil:nativeHealth?Date.now()+nativeHealth.remainingMs:null,nativeHealth,durationMs:performance.now()-start,results:[],infoboxes:[]};
   }
   for(const r of raw.results){if(!r||typeof r!=='object'||!allowedUrl(r.url))throw new Error('unsafe_url_scheme');const names=r.engines || [r.engine];if(!Array.isArray(names)||names.some(n=>n!==engine.id))throw new Error('schema_invalid');if(state.category==='images'&&!allowedUrl(r.img_src))throw new Error('wrong_result_type');}
   return {outcome:raw.results.length||raw.infoboxes?.length?'success':'empty',errorClass:null,results:raw.results.slice(0,100).map(r=>({...r,title:plain(r.title,300),content:plain(r.content)})),infoboxes:Array.isArray(raw.infoboxes)?raw.infoboxes.slice(0,3):[],durationMs:performance.now()-start};
  }catch(e){return {outcome:signal.aborted?'cancelled':'error',errorClass:signal.aborted?'timeout':['schema_invalid','wrong_result_type','unsafe_url_scheme'].includes(e.message)?e.message:'backend_unavailable',durationMs:performance.now()-start,results:[],infoboxes:[]};}
 }
}
