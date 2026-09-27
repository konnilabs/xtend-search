import {dashboard} from './dashboard.mjs';
import {randomUUID} from 'node:crypto';
import {REASONS,MODES,LABELS,requireRole,fail} from './contracts.mjs';
import {suggestedFamily} from './families.mjs';
import {VERSION} from './release.mjs';
const date=t=>t?new Date(t).toLocaleString('de-DE',{timeZone:'Europe/Berlin'}):'noch nicht beobachtet';
const ms=n=>n===null?'–':`${n} ms`;
const categories=[...MODES,'knowledge'];
const categoryLabel=id=>LABELS[id]||(id==='knowledge'?'Wissenskarten':id);
export function poolFilters(input={}){
 input ||= {};
 return {category:categories.includes(input.category)?input.category:'',filterQuery:typeof input.filterQuery==='string'?input.filterQuery.trim().slice(0,100):''};
}
function poolUrl(id,filters){
 const params=new URLSearchParams();if(id)params.set('engine',id);if(filters.category)params.set('category',filters.category);if(filters.filterQuery)params.set('filterQuery',filters.filterQuery);
 return '/admin'+(params.size?'?'+params:'');
}
export function adminView(plane,context,selected='',input={}){
 const snapshot=plane.snapshot(context),filters=poolFilters(input);
 const matches=snapshot.engines.filter(e=>(!filters.category||e.capabilities.includes(filters.category))&&e.id.toLocaleLowerCase('de').includes(filters.filterQuery.toLocaleLowerCase('de')));
 const selectedEngine=matches.find(e=>e.id===selected)||matches[0];
 const engine=selectedEngine||{id:'',capabilities:[],policy:{state:'disabled',rpm:6,concurrency:1,family:'shared',capabilities:[]},states:[],budget:{count:0,reset:0}};
 const policy=engine.policy,familyUntil=snapshot.budgets.find(b=>b.id==='family:'+policy.family)?.blockedUntil||0;const base={
  message:'',notices:[],productLabel:`XTend.search ${VERSION} · Powered by SearXNG`,role:context.role,actor:context.actor,revision:String(snapshot.revision),requestKey:randomUUID(),csrf:context.csrf||'',selected:engine.id,
  filters,url:poolUrl(selected?engine.id:'',filters),hasEngine:!!selectedEngine,emptyPool:!matches.length,
  poolCount:`${matches.length} von ${snapshot.engines.length} Quellen`,resetUrl:poolUrl(engine.id,{}),
  categoryOptions:[{id:'',label:'Alle Kategorien',selected:!filters.category},...categories.map(id=>({id,label:`${categoryLabel(id)} (${snapshot.engines.filter(e=>e.capabilities.includes(id)).length})`,selected:id===filters.category}))],
  capabilityHelp:categories.map(id=>({id,label:categoryLabel(id)})),
  updated:`Stand ${date(snapshot.time)}`,backend:`${snapshot.backend.status} · ${snapshot.backend.version||'Version unbekannt'}`,store:snapshot.storage,storageLabel:'Speicher: '+snapshot.storage,mode:snapshot.mode,
  canAdmin:context.role==='administrator',canOperate:['operator','administrator'].includes(context.role),readOnly:context.role!=='administrator'||process.env.XTEND_ADMIN_MUTATIONS==='0',operatorDisabled:context.role==='viewer'||process.env.XTEND_ADMIN_MUTATIONS==='0',probeDisabled:context.role==='viewer'||!snapshot.probeEnabled||process.env.XTEND_ADMIN_MUTATIONS==='0',probeNote:snapshot.probeEnabled?'Probes verwenden denselben Suchpfad und halten alle Budgets ein.':'Aktive Probes sind in dieser Installation abgeschaltet (XTEND_PROBES=0).',probeCapabilities:engine.capabilities.map((id,i)=>({id,label:id,selected:i===0})),
  summary:[{id:'sources',label:'Freigegebene Quellen',value:String(snapshot.engines.filter(e=>e.policy.state==='allowed').length)},{id:'work',label:'Aktive Ausführungen',value:String(snapshot.inflight)},{id:'drops',label:'Verlorene Telemetrie',value:String(snapshot.drops)},{id:'revision',label:'Policyrevision',value:String(snapshot.revision)}],
  engines:matches.map(e=>({id:e.id,label:e.id,url:poolUrl(e.id,filters),current:e.id===engine.id?'page':'false',detail:`${e.policy.state==='allowed'?'Freigegeben':'Gesperrt'} · ${e.capabilities.map(categoryLabel).join(', ')||'Keine Suchkategorie'}`,selected:e.id===engine.id,className:'engine-choice'+(e.id===engine.id?' selected':'')})),
  engine:{...engine,capabilityLabel:engine.capabilities.map(id=>`${categoryLabel(id)} (${id})`).join(', ')||'Keine Suchkategorie im Katalog',states:engine.states.map(s=>({id:s.capability,label:categoryLabel(s.capability),health:`${s.health} / ${s.breaker}`,freshness:`${s.freshness} · ${date(s.observedAt)}`,samples:`${s.samples} Live-Samples / 1 h · ${s.errors} Fehler · ${s.probes} Probes`,latency:`Erfolgs-Roundtrip p50 ${ms(s.p50)} · p95 ${ms(s.p95)}`,cooldown:s.nextAllowedAt>Date.now()?`Lokal frühestens ${date(s.nextAllowedAt)}; Backend-Ende unbekannt`:'Keine bekannte lokale Sperrfrist',quarantine:s.quarantine||'keine'}))},
  form:{id:engine.id,state:policy.state,rpm:String(policy.rpm),concurrency:String(policy.concurrency),family:policy.family,capabilities:policy.capabilities.join(','),pagingVerified:policy.pagingVerified===true,safeSearchBypass:policy.safeSearchBypass===true,quarantine:policy.quarantine===true,reason:'initial_review'},
  familyHelp:`Gleicher Anbieter oder gemeinsame Zugangsdaten: gleiche Gruppe. Sperren und Budgets gelten für alle Quellen dieser Gruppe.${suggestedFamily(engine.id)?' Geprüfter Vorschlag: '+suggestedFamily(engine.id)+'.':' Anbietergruppe vor der Freigabe prüfen und eintragen.'}${policy.family==='shared'?' Achtung: shared verbindet alle so benannten Quellen, auch unterschiedliche Anbieter.':''}`,
  filterCoverage:`Filterunterstützung: SafeSearch ${engine.safeSearch?'ja':'nein'} · Sprache ${engine.language?'ja':'nein'} · Zeitraum ${engine.timeRange?'ja':'nein'}.${policy.safeSearchBypass===true?' SafeSearch-Ausnahme aktiviert: Quellen ohne eigene Unterstützung dürfen ungefilterte Inhalte liefern.':''}`, 
  reasons:REASONS.map(id=>({id,label:id})),
  budget:`${engine.budget.reset>Date.now()?engine.budget.count:0} / ${policy.rpm} Dispatches im Minutenfenster · ${engine.inflight||0} aktiv · Reset ${date(engine.budget.reset)}`,
  sharedBudgets:[['service','Gesamter Dienst',60,8],['egress','Gemeinsamer Ausgang',60,8],['family:'+policy.family,'Fehlerdomäne '+policy.family,30,4],['probes','Aktive Probes',2,1]].map(([id,label,limit,parallel])=>{const b=snapshot.budgets.find(b=>b.id===id)||{};return {id,label,detail:`${b.reset>Date.now()?b.count||0:0} / ${limit} pro Minute · ${(b.leases||[]).filter(l=>l.until>Date.now()).length} / ${parallel} reservierte Plätze${b.blockedUntil>Date.now()?' · gesperrt bis '+date(b.blockedUntil):''}`};}),
  protection:`${familyUntil>Date.now()?'Gruppe '+policy.family+' ist bis '+date(familyUntil)+' gesperrt; das betrifft auch diese Quelle. ':''}${policy.quarantine?'Admin-Quarantäne aktiv. ':''}${policy.drainedUntil>Date.now()?'Drain bis '+date(policy.drainedUntil)+'. ':''}${engine.probe?'Probe vorgemerkt. ':''}Provider- und Backendfristen bleiben wirksam. Technische Quarantäne: nach Prüfung Grundcode recovery_review wählen und Quarantäne abwählen; Freigabe erfolgt erst nach erfolgreichen Probes.`,
  telemetry:snapshot.events.map(e=>({id:e.id,time:date(Date.parse(e.time)),type:e.type.split('.').slice(4,-1).join('.'),detail:JSON.stringify(e.data)})),
  audit:snapshot.audit.map(e=>({id:String(e.seq),time:date(e.time),detail:`${e.actor} · ${e.action} · ${e.target} · ${e.reason} · Revision ${e.revision}`})),
  history:snapshot.history.map(e=>({id:String(e.minute),time:date(e.minute),detail:`${e.total} Ausführungen · ${e.errors} Fehler · ${Math.round(e.duration/Math.max(1,e.total))} ms mittlerer Adapter-Roundtrip`})),
  skips:snapshot.skips.map(e=>({id:e.reason,detail:`${e.reason}: ${e.count}`})),
  capabilitiesNote:engine.knowledge?'Diese Quelle liefert Wissenskarten. Dafür „knowledge“ als Capability freigeben. Die von SearXNG übernommene Kategorie „general“ belegt in XTend.search keinen Web-Suchplatz. Sprachfilter, SafeSearch und Budgets gelten auch für Wissenskarten.':'Capabilities stammen aus dem geprüften Katalog. Freigabe und Filterabdeckung sind getrennte Entscheidungen. Paging nur nach einem Test des konkreten Providers bestätigen.',
 };
 return {...base,...dashboard(plane,snapshot,base,input,selected)};
}
export class AdminService {
 constructor(plane){this.plane=plane;this.streams=new Map();this.streamCount=0;}
 async snapshot(input,context){requireRole(context,'viewer');await this.plane.refreshHistory();return {...adminView(this.plane,context,input?.id,input),message:''};}
 async mutate(action,input,context){
  requireRole(context,action==='policy'?'administrator':'operator');
  if(typeof input?.id!=='string')fail('validation');
  const normalized={...input};for(const name of ['category','filterQuery','view','status','page','engine','proposal'])delete normalized[name];
  if(action==='policy')normalized.capabilities=typeof input.capabilities==='string'?input.capabilities.split(',').map(s=>s.trim()).filter(Boolean):input.capabilities;
  const previous=action==='policy'?this.plane.policy?.(input.id):null;
  const result=await this.plane.mutate(action,normalized,context);
  const view=adminView(this.plane,context,input.id,input);
  // A notice is created only after the mutation and its audit have succeeded.
  const titles={policy:'Quelleneinstellungen gespeichert',drain:'Quelle pausiert',probe:'Probe vorgemerkt',routing:'Betriebsmodus gespeichert'};
  let title=titles[action],type=action==='drain'?'warning':action==='probe'?'info':'success';
  if(action==='policy'&&previous?.state!==input.state){title=input.state==='allowed'?'Quelle freigegeben':'Quelle gesperrt';type=input.state==='allowed'?'success':'info';}
  const duplicate=result.message==='Aktion war bereits gespeichert.';
  if(duplicate){title='Bereits gespeichert';type='info';}
  const detail=action==='routing'?(input.mode==='adaptive'?'Adaptives Routing ist eingestellt.':'Konservatives Routing ist eingestellt.'):
   action==='probe'?`${input.id}: Die Probe wartet auf ein freies Budget und geltende Schutzfristen.`:
   action==='drain'?`${input.id}: Pause für ${input.minutes} Minuten gespeichert.`:
   input.state==='allowed'?`${input.id}: Freigabe, Capabilities und Budgets sind gespeichert.`:`${input.id}: Für neue Suchanfragen gesperrt.`;
  return {...view,message:result.message,notices:[{id:'admin-notice-'+view.requestKey,title,type,message:duplicate?result.message:detail}]};
 }
 async quality(action,input,context){
  await this.plane.quality.mutate(action,input,context);
  const view=adminView(this.plane,context,input.id,{...input,engine:input.id});
  return {...view,message:'Qualitätsentscheidung gespeichert.',notices:[{id:'quality-'+view.requestKey,title:'Gespeichert',type:'success',message:'Änderung und Audit wurden gemeinsam gespeichert.'}]};
 }
 async evidence(input,context){return this.plane.quality.evidenceLinks(input,context);}
 simulate(input,context){requireRole(context,'viewer');const q=this.plane.quality;const rule={threshold:Number(input.threshold),contexts:Number(input.contexts),windowMinutes:Number(input.windowMinutes)};if(!Number.isFinite(rule.threshold)||rule.threshold<5||rule.contexts<3||rule.windowMinutes<10||rule.windowMinutes>60)fail('validation','Bitte gültige Schwellen eintragen.');const stats=q.stats(input.id,input.capability,q.now()-rule.windowMinutes*60000,true);return {count:stats.count,contexts:stats.contexts,wouldMatch:stats.count>=rule.threshold&&stats.contexts>=rule.contexts,message:'Unverbindliche Schwellenprüfung. Neustartfenster, Schutzfristen, Pausenhäufigkeit und Quellenabdeckung werden zusätzlich vor jeder echten Aktion geprüft.'};}
 async* events(input,context){requireRole(context,'viewer');
  const actor=context.actor;
  if(this.streamCount>=16||(this.streams.get(actor)||0)>=2)fail('overload','Zu viele offene Observatory-Verbindungen. Bitte weitere Admin-Tabs schließen.');
  this.streamCount++;this.streams.set(actor,(this.streams.get(actor)||0)+1);
  const started=Date.now();let last=-1;
  try{
  while(!context.signal.aborted&&Date.now()-started<25000){
   // Every connection starts with a bounded full view. The cursor is a change
   // hint, not an exactly-once event replay contract across process restarts.
   if(this.plane.telemetry.sequence!==last){last=this.plane.telemetry.sequence;yield {type:'delta',value:{cursor:last,reset:true,view:adminView(this.plane,context,input?.id,input)}};}
   await new Promise(resolve=>{const done=()=>{clearTimeout(timer);context.signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,1500);context.signal.addEventListener('abort',done,{once:true});});
  }
  yield {type:'complete',value:{cursor:last}};
  }finally{this.streamCount--;const count=(this.streams.get(actor)||1)-1;if(count)this.streams.set(actor,count);else this.streams.delete(actor);}
 }
}
