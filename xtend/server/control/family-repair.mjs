import {suggestedFamily} from './families.mjs';

// Deliberately narrow repair for the initial shared-default incident. This is
// not a startup migration or a way to reset arbitrary provider restrictions.
export function sharedFamilyRepair(state,catalog,time=Date.now()){
 const policies=new Map(state.policies.map(r=>[r.id,JSON.parse(r.value)]));
 const guards=new Map(state.guards.map(r=>[r.id,JSON.parse(r.value)]));
 const shared=guards.get('family:shared');
 const health=guards.get('health:duckduckgo:general');
 const events=state.events.map(r=>JSON.parse(r.value));
 const deadline=h=>Math.max(h.localBackoffUntil||0,h.providerRetryAfterAt||0,h.backendSuspendedUntil||0,h.quotaResetAt||0);
 if(!shared||!health||shared.blockedUntil!==deadline(health)||shared.blockedUntil<=time||!events.some(e=>e.type.endsWith('engine.observed.v1')&&e.data.engineId==='duckduckgo'&&e.data.errorClass==='captcha'&&Date.parse(e.time)===health.observedAt))throw new Error('Die gemeinsame Sperre lässt sich nicht eindeutig dem beobachteten DuckDuckGo-CAPTCHA zuordnen. Manuelle Prüfung erforderlich.');
 for(const [id,g]of guards){
  if(g.leases?.some(l=>l.until>time))throw new Error('Aktive Reservierungen: Reparatur erst nach Ende aller Suchläufe.');
  if(id.startsWith('health:')&&id!=='health:duckduckgo:general'&&deadline(g)>time)throw new Error('Weitere aktive Schutzfristen benötigen eine manuelle Prüfung.');
 }
 const changes=[];
 for(const [id,p]of policies){
  const family=suggestedFamily(id);
  if(p.family!=='shared'||!family||!p.fingerprint)continue;
  if(catalog.get(id)?.fingerprint!==p.fingerprint)throw new Error('Geänderter Quellenkatalog: erneute Prüfung erforderlich.');
  changes.push({id,from:'shared',to:family});
 }
 const groups=new Set(changes.map(c=>c.to));groups.add('duckduckgo');
 const transferred=[...groups].map(family=>{
  const id='family:'+family,existing=guards.get(id)||{};
  // Copy current usage conservatively to EACH new group, never reset a quota.
  const reset=Math.max(shared.reset||0,existing.reset||0);
  const count=Math.max(shared.reset>time?shared.count||0:0,existing.reset>time?existing.count||0:0);
  return [id,{...existing,reset,count,leases:[],blockedUntil:Math.max(existing.blockedUntil||0,family==='duckduckgo'?shared.blockedUntil:0)}];
 });
 return {revision:state.meta.revision,changes,guards:transferred,preservedDuckDuckGoUntil:shared.blockedUntil};
}
