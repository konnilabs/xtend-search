import {randomInt,createHash,randomUUID} from 'node:crypto';
import {Telemetry} from './telemetry.mjs';
import {suggestedFamily} from './families.mjs';
import {knowledgeLanguageMatches} from './knowledge.mjs';
import {matchesLanguage} from './locales.mjs';
import {enumValue,integer,requireRole,REASONS,fail} from './contracts.mjs';
const defaultPolicy=id=>({state:'disabled',capabilities:[],rpm:6,concurrency:1,family:suggestedFamily(id),drainedUntil:0,quarantine:false,safeSearchBypass:false,reason:'initial_review',fingerprint:''});
const defaultHealth=()=>({health:'unknown',breaker:'closed',observedAt:0,samples:[],consecutive:0,successes:0,watchSince:0,localBackoffUntil:0,providerRetryAfterAt:0,backendSuspendedUntil:0,quotaResetAt:0,nativeScope:null,deadlineSource:'legacy_estimate',recoveryLeaseUntil:0});
const q=(a,p)=>a.length?Math.round([...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]):null;
export class ControlPlane {
 constructor({store,adapter,probeEnabled=false}){this.store=store;this.adapter=adapter;this.telemetry=new Telemetry(store);this.policies=new Map();this.health=new Map();this.buckets=new Map();this.inflight=new Map();this.revision=0;this.mode='conservative';this.storeOK=false;this.stopping=false;this.serial=Promise.resolve();this.probeEnabled=probeEnabled;this.demandRecovery=process.env.XTEND_DEMAND_RECOVERY!=='0';this.knowledgeRotation={family:0,engines:new Map()};this.probes=new Map();this.backendUntil=0;this.skips={};this.lastDispatch=0;this.probeController=new AbortController();this.tickPromise=null;}
 exclusive(fn){const p=this.serial.then(fn);this.serial=p.catch(()=>{});return p;}
 async initialize(){try{this.adopt(await this.store.call('load'));this.storeOK=true;}catch{this.storeOK=false;}void this.refresh();this.timer=setTimeout(()=>void this.scheduleTick(),30000);this.timer.unref();}
 adopt(state){this.motdState=state.motd;this.weatherState=state.weather;this.revision=state.meta.revision;this.mode=state.meta.mode;this.policies=new Map(state.policies.map(p=>[p.id,JSON.parse(p.value)]));if(!this.loaded){for(const row of state.guards){const value=JSON.parse(row.value);if(row.id.startsWith('health:'))this.health.set(row.id.slice(7),{...defaultHealth(),...value,health:'unknown',samples:[]});else if(row.id==='backend')this.backendUntil=value.until;else this.buckets.set(row.id,value);}this.telemetry.restore(state.events||[]);this.loaded=true;}this.audit=state.audit;this.history=state.aggregates;this.quality?.adopt(state.quality);}
 async refresh(){try{await this.adapter.discover();this.telemetry.emit('capability.changed',{backendId:'searxng-primary',policyRevision:this.revision});}catch{this.telemetry.emit('backend.changed',{backendId:'searxng-primary',outcome:'error',errorClass:'backend_unavailable'});}}
 policy(id){return this.policies.get(id)||defaultPolicy(id);}
 healthFor(id,capability){const key=`${id}:${capability}`;if(!this.health.has(key))this.health.set(key,defaultHealth());return this.health.get(key);}
 next(h){return Math.max(h.localBackoffUntil,h.providerRetryAfterAt,h.backendSuspendedUntil,h.quotaResetAt);}
 eligible(engine,state,{probe=false}={}){
  const p=this.policy(engine.id),h=this.healthFor(engine.id,state.category),time=Date.now();
  if(this.stopping||!this.storeOK)return 'storage_unavailable';
  if(this.adapter.status!=='compatible'||time-this.adapter.lastRefresh>600000||time<this.backendUntil)return 'backend_unavailable';
  if(p.state!=='allowed'||p.drainedUntil>time)return p.state==='disabled'?'admin_disabled':'drained';
  if(p.quarantine||h.quarantine)return 'quarantine';
  if((this.buckets.get('family:'+p.family)?.blockedUntil||0)>time)return 'provider_family_cooldown';
  const nativeScope=this.adapter.nativeScopes?.get(engine.id)||h.nativeScope;if(nativeScope&&(this.buckets.get('native:'+nativeScope)?.blockedUntil||0)>time)return 'backend_suspended';
  if(p.fingerprint!==engine.fingerprint)return 'capability_changed';
  if(!p.capabilities.includes(state.category)||!engine.capabilities.includes(state.category))return 'capability';
  // The reviewed Wikipedia/Wikidata adapters serve entity cards, not the
  // general result pool. Their inherited SearXNG "general" category must not
  // consume one of the three regular web slots. Knowledge needs its own grant.
  if(state.category==='general'&&engine.knowledge)return 'knowledge_source';
  if(Number(state.safeSearch)>0&&!engine.safeSearch&&p.safeSearchBypass!==true)return 'safesearch';
  if(state.language!=='all'&&!(state.category==='knowledge'&&knowledgeLanguageMatches(engine,state.language))&&(!engine.language||!engine.languages.some(l=>matchesLanguage(l,state.language))))return 'language';
  if(state.timeRange&&!engine.timeRange)return 'time_range';
  if(state.page>1&&(!engine.paging||!p.pagingVerified))return 'paging';
  if(this.quality?.blocked(engine.id,state.category))return 'quality_cooldown';
  if(time<this.next(h))return 'cooldown';
  if(h.breaker==='open'&&!probe&&!this.demandRecovery)return 'watch_required';
  if(h.breaker==='half_open'&&h.recoveryLeaseUntil>time)return 'watch_required';
  if(h.breaker==='half_open'&&!probe&&!this.demandRecovery)return 'watch_required';
  return null;
 }
 availability(engine,capability){
  const policy=this.policy(engine.id),h=this.healthFor(engine.id,capability),time=Date.now(),scope=this.adapter.nativeScopes?.get(engine.id)||h.nativeScope;
  const family=this.buckets.get('family:'+policy.family),native=scope?this.buckets.get('native:'+scope):null,pause=this.quality?.pause?.(engine.id,capability);
  const deadlines=[[this.next(h),h.deadlineSource],[family?.blockedUntil||0,family?.deadlineSource||'legacy_estimate'],[native?.blockedUntil||0,'native'],[policy.drainedUntil||0,'administrative'],[pause?.until||0,'quality']].sort((a,b)=>b[0]-a[0]);
  const [nextAllowedAt,deadlineSource]=deadlines[0];
  const reason=!this.storeOK?'storage_unavailable':this.adapter.status!=='compatible'||time<this.backendUntil?'backend_unavailable':policy.state!=='allowed'?'admin_disabled':!policy.capabilities.includes(capability)?'capability':policy.fingerprint!==engine.fingerprint?'capability_changed':policy.quarantine||h.quarantine?'quarantine':pause?.until>time?'quality_cooldown':policy.drainedUntil>time?'drained':native?.blockedUntil>time?'backend_suspended':family?.blockedUntil>time?'provider_family_cooldown':this.next(h)>time?'cooldown':h.breaker==='half_open'&&h.recoveryLeaseUntil>time?'recovering':h.breaker!=='closed'?(this.demandRecovery?'recovery_ready':'watch_required'):'available';
  return {reason,nextAllowedAt,permission:policy.state,deadlineSource};
 }
 knowledgePlan(state,limit=1,exclude=[]){
  const candidates=[...this.adapter.catalog.values()].filter(e=>e.capabilities.includes('knowledge')&&!exclude.includes(e.id)&&!this.eligible(e,state));
  const families=[...new Set(candidates.sort((a,b)=>a.id.localeCompare(b.id)).map(e=>this.policy(e.id).family))];if(!families.length)return [];
  const selected=[];for(let n=0;n<families.length&&selected.length<limit;n++){
   const family=families[(this.knowledgeRotation.family+n)%families.length],pool=candidates.filter(e=>this.policy(e.id).family===family).sort((a,b)=>a.id.localeCompare(b.id)),index=this.knowledgeRotation.engines.get(family)||0;
   selected.push(pool[index%pool.length]);if(!exclude.length)this.knowledgeRotation.engines.set(family,index+1);
  }if(!exclude.length)this.knowledgeRotation.family++;return selected;
 }
 plan(state,pinned=null,limit=state.category==='knowledge'?1:3){const selected=[];const all=pinned?pinned.map(id=>this.adapter.catalog.get(id)).filter(Boolean):[...this.adapter.catalog.values()];const candidates=all.filter(e=>{const reason=this.eligible(e,state);if(reason)this.skips[reason]=(this.skips[reason]||0)+1;return !reason;});
  if(this.mode==='adaptive'&&!pinned){while(candidates.length&&selected.length<limit){const weights=candidates.map(e=>{const h=this.healthFor(e.id,state.category);return 1/(1+(q(h.samples.filter(s=>s.outcome==='success').map(s=>s.durationMs),.5)||1000)/1000);});let n=randomInt(1000000)/1000000*weights.reduce((a,b)=>a+b,0);let index=0;while(index<weights.length-1&&(n-=weights[index])>0)index++;selected.push(candidates.splice(index,1)[0]);}}else selected.push(...candidates.sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit));return selected;
 }
 async reserve(engine,state,{probe=false}={}){return this.exclusive(async()=>{
  const reason=this.eligible(engine,state,{probe});if(reason)return {reason};
  const p=this.policy(engine.id),h=this.healthFor(engine.id,state.category),time=Date.now(),reset=Math.floor(time/60000)*60000+60000;
  const scopes=[['service',60,8],['egress',60,8],[`family:${p.family}`,30,4],[`engine:${engine.id}`,p.rpm,p.concurrency],...(probe?[['probes',2,1]]:[])];
  for(const [key,limit,parallel]of scopes){const b=this.buckets.get(key);if((b?.reset>time&&b.count>=limit)||Math.max(this.inflight.get(key)||0,(b?.leases||[]).filter(l=>l.until>time).length)>=parallel){this.skips.budget=(this.skips.budget||0)+1;this.telemetry.emit('budget.exhausted',{engineId:engine.id,capability:state.category,origin:probe?'probe':'live'});return {reason:'budget'};}}
  const recovering=h.breaker!=='closed';const nativeScope=this.adapter.nativeScopes?.get(engine.id)||h.nativeScope;
  const recoveryScopes=['recovery:'+p.family,...(nativeScope?['recovery-native:'+nativeScope]:[])];
  if(recoveryScopes.some(key=>this.buckets.get(key)?.leases?.some(l=>l.until>time)))return {reason:'watch_required'};
  if(recovering)for(const key of recoveryScopes)scopes.push([key,60,1]);
  const lease={id:randomUUID(),until:time+engine.timeout+1000};
  const next=scopes.map(([key])=>{const b=this.buckets.get(key);return [key,{...b,reset,count:(b?.reset>time?b.count:0)+1,leases:[...(b?.leases||[]).filter(l=>l.until>time),lease]}];});
  const recoveryHealth=recovering?{...h,breaker:'half_open',watchSince:time,successes:0,recoveryLeaseUntil:lease.until}:null;
  try{await this.store.call('guards',recoveryHealth?[...next,[`health:${engine.id}:${state.category}`,{...recoveryHealth,samples:[]}]]:next);}catch{this.storeOK=false;return {reason:'storage_unavailable'};}
  for(const [key,b]of next){this.buckets.set(key,b);this.inflight.set(key,(this.inflight.get(key)||0)+1);}this.lastDispatch=time;
  if(recoveryHealth)Object.assign(h,recoveryHealth);
  // Capture the reviewed exception with the reservation; never alter the user's search state.
  const safeSearchBypassed=Number(state.safeSearch)>0&&!engine.safeSearch&&p.safeSearchBypass===true;
  let done=false;return {safeSearchBypassed,recovering,release:()=>{if(done)return;done=true;if(recovering){const current=this.healthFor(engine.id,state.category);if(current.breaker==='half_open'&&current.recoveryLeaseUntil===lease.until){current.breaker='open';current.recoveryLeaseUntil=0;}}for(const [key]of next)this.inflight.set(key,Math.max(0,(this.inflight.get(key)||0)-1));void this.exclusive(async()=>{if(this.stopping)return;const guards=next.map(([key])=>[key,{...this.buckets.get(key),leases:(this.buckets.get(key)?.leases||[]).filter(l=>l.id!==lease.id&&l.until>Date.now())}]);if(recovering)guards.push([`health:${engine.id}:${state.category}`,{...this.healthFor(engine.id,state.category),samples:[]}]);try{await this.store.call('guards',guards);for(const [key,b]of guards)if(!key.startsWith('health:'))this.buckets.set(key,b);}catch{this.storeOK=false;}});}};
 });}
 async observe(engine,state,result,origin='live'){return this.exclusive(async()=>{
  const h=this.healthFor(engine.id,state.category),time=Date.now();
  this.telemetry.emit('engine.observed',{backendId:'searxng-primary',engineId:engine.id,capability:state.category,origin,outcome:result.outcome,errorClass:result.errorClass,durationMs:result.durationMs,validResultCount:result.results?.length||0,validKnowledgeCount:result.validKnowledgeCount||0,policyRevision:this.revision,retryNotBefore:result.retryNotBefore});
  if(result.outcome==='cancelled')return;
  if(['backend_unavailable','backend_ingress_limit'].includes(result.errorClass)){this.backendUntil=Math.max(time+30000,result.retryNotBefore||0);try{await this.store.call('guards',[['backend',{until:this.backendUntil}]]);}catch{this.storeOK=false;}return;}
  h.observedAt=time;h.samples.push({time,outcome:result.outcome,durationMs:result.durationMs,origin});h.samples=h.samples.filter(s=>s.time>time-3600000).slice(-200);
  if(result.outcome==='error'){
   h.consecutive++;h.successes=0;h.health='degraded';
   if(['schema_invalid','wrong_result_type','unsafe_url_scheme'].includes(result.errorClass)){h.health='unavailable';h.localBackoffUntil=Math.max(h.localBackoffUntil,time+3600000);h.quarantine=result.errorClass;}
   if(h.consecutive>=3||['captcha','rate_limit','access_denied','unknown'].includes(result.errorClass)||h.breaker==='half_open'){
    h.breaker='open';h.health='unavailable';h.recoveryLeaseUntil=0;const previousEstimate=h.deadlineSource==='legacy_estimate'?h.localBackoffUntil:0;const precise=result.nativeHealth&&Number.isFinite(result.backendSuspendedUntil);const fallback=result.errorClass==='captcha'?1296000000:result.errorClass==='access_denied'?86400000:['rate_limit','unknown'].includes(result.errorClass)?3600000:60000*2**Math.min(h.consecutive,6);h.localBackoffUntil=Math.max(h.localBackoffUntil,time+(precise?1000:fallback)+randomInt(1000,5000));h.deadlineSource=precise&&previousEstimate<=Math.max(time+6000,result.backendSuspendedUntil||0)?'native':'legacy_estimate';
   }
   if(result.nativeHealth){h.nativeScope=result.nativeHealth.scope;h.backendSuspendedUntil=Math.max(h.backendSuspendedUntil,result.backendSuspendedUntil||0);}
   if(result.retryNotBefore)h.providerRetryAfterAt=Math.max(h.providerRetryAfterAt,result.retryNotBefore);
  }else if(['success','empty'].includes(result.outcome)){
   h.consecutive=0;h.successes++;h.health='healthy';h.breaker='closed';h.recoveryLeaseUntil=0;
  }else h.health=h.health==='unknown'?'unknown':h.health;
  const guards=[[`health:${engine.id}:${state.category}`,{...h,samples:[]}]];
  if(['captcha','rate_limit','access_denied'].includes(result.errorClass)){const family='family:'+this.policy(engine.id).family;const guard={...(this.buckets.get(family)||{}),blockedUntil:Math.max(this.buckets.get(family)?.blockedUntil||0,this.next(h)),deadlineSource:h.deadlineSource};this.buckets.set(family,guard);guards.push([family,guard]);}
  if(result.nativeHealth?.remainingMs>0){const key='native:'+result.nativeHealth.scope;const guard={...(this.buckets.get(key)||{}),blockedUntil:Math.max(this.buckets.get(key)?.blockedUntil||0,result.backendSuspendedUntil||0)};this.buckets.set(key,guard);guards.push([key,guard]);}
  try{await this.store.call('guards',guards);}catch{this.storeOK=false;}
 });}
 async mutate(action,input,context){return this.exclusive(async()=>{
  requireRole(context,['policy','motd','weather'].includes(action)?'administrator':'operator');if(process.env.XTEND_ADMIN_MUTATIONS==='0')fail('readonly','Änderungen sind im Betriebsmodus gesperrt.');
  const revision=integer(input.revision,0,Number.MAX_SAFE_INTEGER,'Revision');const reason=enumValue(input.reason,REASONS);
  if(typeof input.requestKey!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestKey))fail('validation','Ungültige Aktionskennung.');
  const mutation={revision,reason,actor:context.actor,action,target:'routing',requestKey:context.actor+':'+input.requestKey,digest:createHash('sha256').update(JSON.stringify([action,Object.keys(input).sort().map(k=>[k,input[k]])])).digest('hex')};
  if(action==='weather'){mutation.target='weather.open-meteo';mutation.weather=input.weather;}
  else if(action==='motd'){mutation.target='home.motd';mutation.motd=input.motd;}
  else if(action==='routing'){mutation.mode=enumValue(input.mode,['conservative','adaptive']);}
  else{
   const engine=this.adapter.catalog.get(input.id);if(!engine)fail('validation','Quelle ist nicht im aktuellen Katalog.');const policy={...this.policy(engine.id)};mutation.target=engine.id;
   if(action==='policy'){
    policy.state=enumValue(input.state,['allowed','disabled']);policy.rpm=integer(input.rpm,1,600,'Dispatches pro Minute');policy.concurrency=integer(input.concurrency,1,4,'Parallelität');
    if(!Array.isArray(input.capabilities)||input.capabilities.some(c=>!engine.capabilities.includes(c)))fail('validation','Nicht unterstützte Capability.');
    policy.capabilities=[...new Set(input.capabilities)];if(policy.state==='allowed'&&!policy.capabilities.length)fail('validation','Mindestens eine Capability auswählen.');
    if(typeof input.family!=='string'||!/^[a-z0-9_-]{1,60}$/.test(input.family))fail('validation','Fehlerdomäne: Kleinbuchstaben, Zahlen, _ oder -.');
    if(['wikipedia','wikidata'].includes(engine.id)||engine.id.startsWith('wikicommons')){if(input.family!=='wikimedia')fail('validation','Diese Quelle gehört zur gemeinsamen Domäne wikimedia.');}
    if(engine.id==='ddg definitions'&&input.family!=='duckduckgo')fail('validation','Diese Knowledge-Quelle gehört zur gemeinsamen Domäne duckduckgo.');
    if(reason==='recovery_review'&&input.quarantine===false){mutation.recover=engine.capabilities.map(c=>{const h=this.healthFor(engine.id,c);return [`health:${engine.id}:${c}`,{...h,quarantine:null,breaker:'open',successes:0,health:'unknown',samples:[]}];});}
    if(input.safeSearchBypass!==undefined&&typeof input.safeSearchBypass!=='boolean')fail('validation','SafeSearch-Ausnahme muss ein Wahrheitswert sein.');
    if(input.safeSearchBypass!==undefined)policy.safeSearchBypass=input.safeSearchBypass;
    policy.family=input.family;policy.pagingVerified=input.pagingVerified===true&&engine.paging;policy.quarantine=input.quarantine===true;policy.fingerprint=engine.fingerprint;
   }else if(action==='drain'){policy.drainedUntil=Date.now()+integer(input.minutes,1,1440,'Drain-Dauer')*60000;}
   else if(action==='probe'){enumValue(input.capability,engine.capabilities);if(!this.probeEnabled)fail('probe_disabled','Probes sind über XTEND_PROBES=0 gesperrt.');}
   else fail('validation');
   policy.reason=reason;if(action!=='probe')mutation.policy=policy;
  }
  let state;try{state=await this.store.call('mutation',mutation);}catch(e){if(e.code==='conflict')fail('conflict','Der Stand wurde zwischenzeitlich geändert. Bitte aktualisieren und erneut prüfen.');fail('audit_unavailable','Audit konnte nicht gespeichert werden. Es wurde keine Änderung bestätigt.');}
  this.adopt(state);if(mutation.recover&&!state.duplicate)for(const [key,h]of mutation.recover)this.health.set(key.slice(7),h);if(action==='probe'&&!state.duplicate)this.probes.set(input.id,{requestedAt:Date.now(),capability:enumValue(input.capability,this.adapter.catalog.get(input.id).capabilities)});
  if(!state.duplicate)this.telemetry.emit(action==='probe'?'probe.requested':action==='motd'?'content.changed':'policy.changed',{engineId:mutation.target,policyRevision:this.revision,reason});
  return {ok:true,message:state.duplicate?'Aktion war bereits gespeichert.':action==='probe'?'Probe vorgemerkt; Schutzfristen und Budgets bleiben wirksam.':'Änderung und Audit gespeichert.',snapshot:this.snapshot(context)};
 });}
 snapshot(context){requireRole(context,'viewer');const time=Date.now();const engines=[...this.adapter.catalog.values()].map(e=>{
  const p=this.policy(e.id);const caps=e.capabilities.map(c=>{const h=this.healthFor(e.id,c),samples=h.samples.filter(s=>s.time>time-3600000),live=samples.filter(s=>s.origin==='live'),success=live.filter(s=>s.outcome==='success').map(s=>s.durationMs);return {capability:c,health:h.health,breaker:h.breaker,observedAt:h.observedAt,freshness:!h.observedAt?'unknown':time-h.observedAt>900000?'stale':'fresh',samples:live.length,errors:live.filter(s=>s.outcome==='error').length,successes:success.length,probes:samples.filter(s=>s.origin==='probe').length,p50:q(success,.5),p95:q(success,.95),nextAllowedAt:this.next(h),backendSuspendedUntil:h.backendSuspendedUntil||null,deadlineSource:h.deadlineSource,recoveryLeaseUntil:h.recoveryLeaseUntil,demandRecovery:this.demandRecovery,availability:this.availability(e,c),providerDurationMs:null,measurementScope:'adapter_round_trip',quarantine:h.quarantine||null};});return {...e,policy:p,states:caps,inflight:this.inflight.get(`engine:${e.id}`)||0,budget:this.buckets.get(`engine:${e.id}`)||{count:0,reset:0},probe:this.probes.has(e.id)};});
  return {time,revision:this.revision,mode:this.mode,backend:{status:this.adapter.status,version:this.adapter.version||null,refreshedAt:this.adapter.lastRefresh,blockedUntil:this.backendUntil},storage:this.storeOK?'ready':'unavailable',engines,events:this.telemetry.recent.slice(-60).reverse(),audit:this.audit||[],history:this.history||[],drops:this.telemetry.dropped,inflight:this.inflight.get('service')||0,budgets:[...this.buckets].map(([id,b])=>({id,...b})),skips:Object.entries(this.skips).map(([reason,count])=>({reason,count})),probeEnabled:this.probeEnabled,role:context.role};
 }
 async refreshHistory(){try{const s=await this.store.call('load');this.audit=s.audit;this.history=s.aggregates;}catch{this.storeOK=false;}}
 scheduleTick(){this.tickPromise=this.tick().catch(()=>{this.telemetry.emit('backend.changed',{outcome:'error',errorClass:'unknown'});}).finally(()=>{this.tickPromise=null;});return this.tickPromise;}
 async tick(){if(this.stopping)return;try{
  if(Date.now()-this.adapter.lastRefresh>300000)await this.refresh();
  if(this.quality)await this.exclusive(()=>this.quality.tick());
  if(this.probeEnabled){
   for(const e of this.adapter.catalog.values()){
    const p=this.policy(e.id);if(p.state!=='allowed')continue;
    for(const c of p.capabilities){const h=this.healthFor(e.id,c);if(Date.now()-h.observedAt>900000&&!this.probes.has(e.id))this.probes.set(e.id,{capability:c,requestedAt:Date.now()});}
   }
   for(const [id,probe]of this.probes){const e=this.adapter.catalog.get(id);if(!e){this.probes.delete(id);continue;}const state={q:'open source',category:probe.capability,language:'all',safeSearch:'0',page:1,timeRange:''};const r=await this.reserve(e,state,{probe:true});if(r.reason)continue;this.probes.delete(id);try{const result=await this.adapter.execute(e,state,AbortSignal.any([this.probeController.signal,AbortSignal.timeout(e.timeout)]));await this.observe(e,state,result,'probe');}finally{r.release();}break;}
  }
 }finally{if(!this.stopping){this.timer=setTimeout(()=>void this.scheduleTick(),30000+randomInt(5000));this.timer.unref();}}}
 async close(){this.stopping=true;clearTimeout(this.timer);this.probeController.abort();await this.tickPromise;await this.serial;await this.telemetry.close();await this.store.close();}
}
