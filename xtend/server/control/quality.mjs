import {createCipheriv,createDecipheriv,randomBytes,createHmac,randomUUID,createHash} from 'node:crypto';
import {FEEDBACK_REASONS,AUTO_REASONS,QUALITY_DEFAULTS} from '../../shared/feedback.mjs';
import {allowedUrl,requireRole,fail,integer} from './contracts.mjs';
const HOUR=3600000,DAY=24*HOUR;
const scope=(id,capability)=>JSON.stringify([id,capability]);
export class QualityService {
 constructor(plane,evidence,{now=Date.now}={}){this.plane=plane;this.evidence=evidence;this.now=now;this.boot=now();this.secret=randomBytes(32);this.window=new Map();this.used=new Map();this.limits=new Map();this.state={rules:[],pauses:[],proposals:[],counts:[]};plane.quality=this;}
 adopt(state){if(state)this.state=state;}
 ticket(url,engines,capability,id){const u=allowedUrl(url);if(!u||u.href.length>4096||!engines.length)return '';u.hash='';const claims={v:1,id:createHmac('sha256',this.secret).update(id).digest('hex'),url:u.href,capability,engines:[...new Set(engines)].map(id=>({id,fingerprint:this.plane.adapter.catalog.get(id)?.fingerprint})),expires:this.now()+30*60000};const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.secret,iv);return Buffer.concat([iv,c.update(JSON.stringify(claims)),c.final(),c.getAuthTag()]).toString('base64url');}
 claims(ticket){try{if(typeof ticket!=='string'||ticket.length>10000)throw 0;const b=Buffer.from(ticket,'base64url'),c=createDecipheriv('aes-256-gcm',this.secret,b.subarray(0,12));c.setAuthTag(b.subarray(-16));const value=JSON.parse(Buffer.concat([c.update(b.subarray(12,-16)),c.final()]).toString());if(value.v!==1||value.expires<this.now()||!Array.isArray(value.engines)||value.engines.length>5||!allowedUrl(value.url))throw 0;return value;}catch{fail('feedback_expired','Dieser Ergebnisnachweis ist abgelaufen. Bitte die Suche erneut aufrufen.');}}
 browser(req,res){const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('xtend_feedback='))?.slice(15);let id;
  try{const [value,mac]=cookie.split('.');if(mac!==createHmac('sha256',this.secret).update(value).digest('base64url'))throw 0;const data=JSON.parse(Buffer.from(value,'base64url').toString());if(data.expires<this.now())throw 0;id=data.id;}catch{}
  if(!id){id=randomUUID();const value=Buffer.from(JSON.stringify({id,expires:this.now()+DAY})).toString('base64url'),mac=createHmac('sha256',this.secret).update(value).digest('base64url');res.setHeader('Set-Cookie',`xtend_feedback=${value}.${mac}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);}
  return {browser:id,csrf:createHmac('sha256',this.secret).update('csrf:'+id).digest('base64url'),network:createHmac('sha256',this.secret).update(req.socket.remoteAddress||'unknown').digest('hex')};
 }
 protect(req,res,origin){if(req.headers.origin!==origin)fail('csrf','Anfrage abgelehnt.');const context=this.browser(req,res);if(req.headers['x-csrf-token']!==context.csrf)fail('csrf','Bitte den Meldedialog erneut öffnen.');return context;}
 prune(){const time=this.now();for(const [id,until]of this.used)if(until<=time)this.used.delete(id);for(const [id,b]of this.limits)if(b.until<=time)this.limits.delete(id);for(const [id,rows]of this.window){const fresh=rows.filter(r=>r.time>time-HOUR);if(fresh.length)this.window.set(id,fresh);else this.window.delete(id);}}
 consume(key,max,duration){let b=this.limits.get(key);if(!b||b.until<=this.now()){if(this.limits.size>=20000)fail('overload','Meldungen sind vorübergehend ausgelastet.');this.limits.set(key,b={count:0,until:this.now()+duration});}if(b.count>=max)fail('feedback_limit','Zu viele Meldungen. Bitte später erneut versuchen.');b.count++;}
 rule(id,capability){return {...QUALITY_DEFAULTS,...this.state.rules.find(r=>r.engine===id&&r.capability===capability)?.value};}
 pause(id,capability){return this.state.pauses.find(r=>r.engine===id&&r.capability===capability);}
 blocked(id,capability){return (this.pause(id,capability)?.until||0)>this.now();}
 stats(id,capability,after=0,automatic=false,extra=[]){const rows=[...(this.window.get(scope(id,capability))||[]),...extra].filter(r=>r.time>Math.max(after,this.now()-HOUR)&&(!automatic||AUTO_REASONS.includes(r.reason)));return {count:rows.length,contexts:new Set(rows.map(r=>r.browser)).size,reasons:Object.fromEntries(Object.keys(FEEDBACK_REASONS).map(reason=>[reason,rows.filter(r=>r.reason===reason).length]))};}
 async submit(input,context){if(!context.browser)fail('csrf');const claims=this.claims(input?.ticket);if(!Object.hasOwn(FEEDBACK_REASONS,input.reason)||typeof input.includeUrl!=='boolean')fail('validation','Bitte einen Meldegrund auswählen.');
  return this.plane.exclusive(async()=>{this.prune();if(this.used.has(claims.id))return {ok:true,duplicate:true,message:'Diese Meldung wurde bereits aufgenommen.'};if(this.used.size>=20000)fail('overload');
   this.consume('browser-minute:'+context.browser,5,60000);this.consume('browser-day:'+context.browser,20,DAY);this.consume('network:'+context.network,60,60000);this.consume('global',120,60000);
   const engines=claims.engines.filter(e=>this.plane.adapter.catalog.get(e.id)?.fingerprint===e.fingerprint&&this.plane.adapter.catalog.get(e.id)?.capabilities.includes(claims.capability));if(!engines.length)fail('feedback_expired','Die Quelle wurde geändert. Bitte die Suche aktualisieren.');
   const time=this.now(),entry={time,browser:context.browser,reason:input.reason},proposals=[];let evidence=null;
   for(const e of engines){const previous=this.state.proposals.filter(p=>p.engine===e.id&&p.capability===claims.capability&&p.kind==='review').sort((a,b)=>b.updated-a.updated)[0],stats=this.stats(e.id,claims.capability,previous&&previous.status!=='pending'?previous.updated:0,false,[entry]);if(stats.count>=5&&stats.contexts>=3&&previous?.status!=='pending')proposals.push({id:randomUUID(),engine:e.id,capability:claims.capability,kind:'review',status:'pending',created:time,updated:time});}
   try{if(input.includeUrl)evidence=await this.evidence.put(claims.url);const result=await this.plane.store.call('feedback',{report:claims.id,time,engines:engines.map(e=>e.id),capability:claims.capability,reason:input.reason,evidence,proposals});this.adopt(result.quality);if(!result.inserted){if(evidence)await this.evidence.remove(evidence);this.used.set(claims.id,claims.expires);return {ok:true,duplicate:true,message:'Diese Meldung wurde bereits aufgenommen.'};}}
   catch{if(evidence)await this.evidence.remove(evidence).catch(()=>{});fail('audit_unavailable','Die Meldung konnte nicht gespeichert werden. Bitte erneut versuchen.');}
   this.used.set(claims.id,claims.expires);for(const e of engines){const key=scope(e.id,claims.capability);this.window.set(key,[...(this.window.get(key)||[]),entry]);this.plane.telemetry.emit('feedback.received',{engineId:e.id,capability:claims.capability,origin:'feedback',reason:input.reason});}
   for(const p of proposals)this.plane.telemetry.emit('quality.proposed',{engineId:p.engine,capability:p.capability,origin:'feedback'});
   for(const e of engines)await this.evaluate(e.id,claims.capability).catch(()=>this.plane.telemetry.emit('quality.changed',{engineId:e.id,capability:claims.capability,origin:'automatic',outcome:'error'}));
   return {ok:true,message:input.includeUrl?'Meldung aufgenommen. Der freiwillige Beleg wird spätestens nach sieben Tagen gelöscht.':'Meldung ohne Ergebnislink aufgenommen.'};
  });
 }
 async submitBatch(input,context){
  if(!context.browser)fail('csrf');
  if(!Array.isArray(input?.tickets)||input.tickets.length<1||input.tickets.length>5||new Set(input.tickets).size!==input.tickets.length||!Object.hasOwn(FEEDBACK_REASONS,input.reason)||typeof input.includeUrl!=='boolean'||!/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestKey||''))fail('validation','Bitte 1–5 Ergebnisse und einen Meldegrund auswählen.');
  const claims=input.tickets.map(t=>this.claims(t));if(new Set(claims.map(c=>c.id)).size!==claims.length)fail('validation','Ein Ergebnis wurde mehrfach ausgewählt.');
  const digest=createHash('sha256').update(JSON.stringify([claims.map(c=>[c.id,c.url,c.capability,c.engines]).sort((a,b)=>a[0].localeCompare(b[0])),input.reason,input.includeUrl])).digest('hex'),id=context.browser+':'+input.requestKey;
  return this.plane.exclusive(async()=>{
   this.prune();try{if(await this.plane.store.call('feedbackBatchCheck',{id,digest}))return {ok:true,duplicate:true,message:'Diese Meldung wurde bereits aufgenommen.'};}catch{fail('conflict','Die Aktionskennung wurde bereits anders verwendet.');}
   if(claims.some(c=>this.used.has(c.id)))fail('feedback_duplicate','Ein ausgewähltes Ergebnis wurde bereits gemeldet. Bitte aus der Auswahl entfernen.');
   const rows=claims.map(c=>({...c,engines:c.engines.filter(e=>this.plane.adapter.catalog.get(e.id)?.fingerprint===e.fingerprint&&this.plane.adapter.catalog.get(e.id)?.capabilities.includes(c.capability))}));
   if(rows.some(c=>!c.engines.length))fail('feedback_expired','Eine Quelle wurde geändert. Bitte die Suche aktualisieren.');
   const charges=[['browser-minute:'+context.browser,5,60000],['browser-day:'+context.browser,20,DAY],['network:'+context.network,60,60000],['global',120,60000]];
   if(this.used.size+rows.length>20000||this.limits.size+4>20000)fail('overload');
   for(const [key,max]of charges){const b=this.limits.get(key);if(b&&b.until>this.now()&&b.count+rows.length>max)fail('feedback_limit','Zu viele Meldungen. Bitte später erneut versuchen.');}
   const votes=[...new Map(rows.flatMap(c=>c.engines.map(e=>[scope(e.id,c.capability),{engine:e.id,capability:c.capability}]))).values()],time=this.now(),entry={time,browser:context.browser,reason:input.reason},proposals=[],files=[],evidence=[];
   for(const v of votes){const previous=this.state.proposals.filter(p=>p.engine===v.engine&&p.capability===v.capability&&p.kind==='review').sort((a,b)=>b.updated-a.updated)[0],stats=this.stats(v.engine,v.capability,previous&&previous.status!=='pending'?previous.updated:0,false,[entry]);if(stats.count>=5&&stats.contexts>=3&&previous?.status!=='pending')proposals.push({id:randomUUID(),...v,kind:'review',status:'pending',created:time,updated:time});}
   try{
    if(input.includeUrl)for(const c of rows){const key=await this.evidence.put(c.url);files.push(key);for(const e of c.engines)evidence.push({engine:e.id,capability:c.capability,evidence:key});}
    const result=await this.plane.store.call('feedbackBatch',{id,digest,time,proofs:rows.map(c=>c.id),votes,reason:input.reason,evidence,proposals});this.adopt(result.quality);
    if(result.duplicate){await Promise.all(files.map(f=>this.evidence.remove(f)));return {ok:true,duplicate:true,message:'Diese Meldung wurde bereits aufgenommen.'};}
   }catch(error){await Promise.all(files.map(f=>this.evidence.remove(f).catch(()=>{})));fail(error.code==='proof_used'?'feedback_duplicate':'audit_unavailable',error.code==='proof_used'?'Ein ausgewähltes Ergebnis wurde bereits gemeldet.':'Die Meldung konnte nicht gespeichert werden. Bitte erneut versuchen.');}
   for(const c of rows)this.used.set(c.id,c.expires);for(const [key,max,duration]of charges)for(const _ of rows)this.consume(key,max,duration);
   for(const v of votes){const key=scope(v.engine,v.capability);this.window.set(key,[...(this.window.get(key)||[]),entry]);this.plane.telemetry.emit('feedback.received',{engineId:v.engine,capability:v.capability,origin:'feedback',reason:input.reason});}
   for(const p of proposals)this.plane.telemetry.emit('quality.proposed',{engineId:p.engine,capability:p.capability,origin:'feedback'});
   for(const v of votes)await this.evaluate(v.engine,v.capability).catch(()=>{});
   return {ok:true,count:rows.length,message:input.includeUrl?'Meldung aufgenommen. Freiwillige Belege werden spätestens nach sieben Tagen gelöscht.':'Meldung ohne Ergebnislinks aufgenommen.'};
  });
 }
 async commit(action,input,context,extra){const time=this.now(),requestKey=context.actor+':'+input.requestKey,digest=createHash('sha256').update(JSON.stringify([action,input])).digest('hex');let result;
  try{result=await this.plane.store.call('mutation',{revision:integer(input.revision,0,Number.MAX_SAFE_INTEGER),reason:'insufficient_editorial_quality',actor:context.actor,action,target:input.id+':'+input.capability,requestKey,digest,time,...extra});}
  catch(e){fail(e.code==='conflict'?'conflict':'audit_unavailable',e.code==='conflict'?'Der Stand wurde geändert. Bitte aktualisieren und erneut prüfen.':'Änderung und Audit konnten nicht gespeichert werden.');}
  this.plane.adopt(result);this.plane.telemetry.emit('quality.changed',{engineId:input.id,capability:input.capability,origin:context.actor==='system:quality'?'automatic':'admin',policyRevision:this.plane.revision});return result;
 }
 async evaluate(id,capability){const rule=this.rule(id,capability),time=this.now(),p=this.plane.policy(id);if(!rule.enabled||time-this.boot<HOUR||process.env.XTEND_ADMIN_MUTATIONS==='0'||p.state!=='allowed'||!p.capabilities.includes(capability)||this.blocked(id,capability)||(this.pause(id,capability)?.lastAutoAt||0)>time-DAY)return;
  const stats=this.stats(id,capability,time-rule.windowMinutes*60000,true);if(stats.count<rule.threshold||stats.contexts<rule.contexts)return;
  const state={category:capability,language:'all',safeSearch:'0',timeRange:'',page:1};const candidates=[...this.plane.adapter.catalog.values()].filter(e=>(capability!=='general'||!e.knowledge)&&!this.plane.eligible(e,state));if(!candidates.some(e=>e.id===id)||!candidates.some(e=>e.id!==id))return;
  const proposal=this.state.proposals.find(p=>p.engine===id&&p.capability===capability&&p.kind==='review'&&p.status==='pending');
  await this.commit('quality.auto_cooldown',{id,capability,revision:this.plane.revision,requestKey:randomUUID()},{actor:'system:quality'},{qualityPause:{engine:id,capability,until:time+rule.cooldownMinutes*60000,lastAutoAt:time},...(proposal?{qualityDecision:{id:proposal.id,status:'automatic',updated:time}}:{})});
 }
 async mutate(action,input,context){requireRole(context,action==='rule'||input?.decision==='disable'?'administrator':'operator');if(process.env.XTEND_ADMIN_MUTATIONS==='0')fail('readonly');if(!/^[a-zA-Z0-9_-]{16,100}$/.test(input?.requestKey||''))fail('validation');
  return this.plane.exclusive(async()=>{
   const digest=createHash('sha256').update(JSON.stringify(['quality.'+action,input])).digest('hex');let duplicate;try{duplicate=await this.plane.store.call('mutationCheck',{requestKey:context.actor+':'+input.requestKey,digest});}catch{fail('conflict','Der Aktionsschlüssel wurde bereits anders verwendet.');}if(duplicate)return {ok:true,duplicate:true};
   const engine=this.plane.adapter.catalog.get(input.id);if(!engine||!engine.capabilities.includes(input.capability))fail('validation','Unbekannte Quelle oder Capability.');let extra={};const time=this.now();
   if(action==='rule'){if(typeof input.enabled!=='boolean')fail('validation');const value={enabled:input.enabled,threshold:integer(input.threshold,5,1000),contexts:integer(input.contexts,3,100),windowMinutes:integer(input.windowMinutes,10,60),cooldownMinutes:integer(input.cooldownMinutes,5,60)};if(value.contexts>value.threshold)fail('validation','Kontexte dürfen die Meldungsschwelle nicht überschreiten.');extra.qualityRule={engine:input.id,capability:input.capability,value};}
   else if(action==='decision'){const proposal=this.state.proposals.find(p=>p.id===input.proposal&&p.engine===input.id&&p.capability===input.capability);if(!proposal||proposal.status!=='pending')fail('conflict','Dieser Vorschlag wurde bereits bearbeitet.');if(!['dismiss','confirm','cooldown','disable'].includes(input.decision))fail('validation');extra.qualityDecision={id:proposal.id,status:input.decision==='dismiss'?'dismissed':input.decision==='confirm'?'confirmed':'applied',updated:time};if(input.decision==='cooldown')extra.qualityPause={engine:input.id,capability:input.capability,until:Math.max(this.pause(input.id,input.capability)?.until||0,time+15*60000),lastAutoAt:this.pause(input.id,input.capability)?.lastAutoAt||0};if(input.decision==='disable'){extra.policy={...this.plane.policy(input.id),state:'disabled',reason:'insufficient_editorial_quality'};extra.target=input.id;}}
   else if(action==='resume'){extra.qualityPause={engine:input.id,capability:input.capability,until:0,lastAutoAt:this.pause(input.id,input.capability)?.lastAutoAt||0};}else fail('validation');
   const result=await this.commit('quality.'+action,input,context,extra);if(action==='rule')this.window.delete(scope(input.id,input.capability));return {ok:true,duplicate:result.duplicate===true};
  });
 }
 async evidenceLinks(input,context){requireRole(context,'operator');const rows=await this.plane.store.call('qualityEvidence',{engine:input.id,capability:input.capability,since:this.now()-7*DAY});const links=[];for(const r of rows){const url=await this.evidence.get(r.evidence);if(url)links.push({id:r.evidence,url,reason:FEEDBACK_REASONS[r.reason],time:r.time});}return links;}
 async tick(){this.prune();await this.evidence.rotate();this.adopt(await this.plane.store.call('qualityRotate',{time:this.now()}));for(const r of this.state.rules)await this.evaluate(r.engine,r.capability);}
}
