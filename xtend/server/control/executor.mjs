import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {baseData,normalizeResults} from '../search.mjs';
import {preferenceSearchUrl as searchUrl} from '../preferences.mjs';
import {validateQuery,fail,LABELS,plain,allowedUrl} from './contracts.mjs';
import {unavailableMessage} from './families.mjs';
import {sourceFailureMessage,sourceSkippedMessage} from './source-messages.mjs';
export class SearchExecutor {
 constructor(plane,media,key,features={}){this.features=features;this.plane=plane;this.media=media;this.key=key;this.active=0;}
 sign(plan,state,page){const body=Buffer.from(JSON.stringify({v:1,engines:plan.map(e=>e.id),category:state.category,page,exp:Date.now()+900000})).toString('base64url');return body+'.'+this.mac(body,state);}
 mac(body,state){return createHmac('sha256',this.key).update(JSON.stringify([body,state.q,state.category,state.language,state.safeSearch,state.timeRange])).digest('base64url');}
 continuation(state){if(!state.continuation){if(state.page>1)fail('cursor','Diese Ergebnisseite benötigt einen gültigen Fortsetzungslink. Bitte erneut suchen.');return null;}const [body,signature,...rest]=state.continuation.split('.'),expected=this.mac(body,state);if(rest.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail('cursor','Der Fortsetzungslink ist ungültig.');let c;try{c=JSON.parse(Buffer.from(body,'base64url').toString());}catch{fail('cursor');}if(c.v!==1||c.exp<Date.now()||c.page!==state.page||c.category!==state.category||!Array.isArray(c.engines)||c.engines.length>5||c.engines.some(x=>typeof x!=='string'))fail('cursor','Der Fortsetzungslink ist abgelaufen oder ungültig.');return c.engines;}
 base(state){const data=baseData(state);data.standalone=true;data.searchRole='search';data.classicUrl='/';data.tabs=Object.entries(LABELS).filter(([id])=>['general','images'].includes(id)||[...this.plane.adapter.catalog.values()].some(e=>this.plane.policy(e.id).state==='allowed'&&this.plane.policy(e.id).capabilities.includes(id))).map(([id,label])=>({id,label,url:searchUrl(state,{category:id,page:1,continuation:''}),className:'tab'+(id===state.category?' active':''),current:id===state.category?'page':'false'}));data.statusLabel='';data.knowledgeStatus='not_applicable';data.showKnowledge=false;data.knowledgeMessage='';return data;}
 async* run(state,{signal}={}){
  if(!state.q.trim()){yield {event:'search.summary',data:this.base(state)};return;}
  validateQuery(state.q);const pinned=this.continuation(state);
  if(this.active>=16)fail('overload','Die Suche ist ausgelastet. Bitte in Kürze erneut versuchen.');this.active++;const started=Date.now();
  const controller=new AbortController(),total=AbortSignal.timeout(12000),combined=AbortSignal.any([controller.signal,...(signal?[signal]:[]),total]);
  const plan=this.plane.plan(state,pinned);const knowledgeState={...state,category:'knowledge',page:1};
  const excludedSources=[...this.plane.adapter.catalog.values()].filter(e=>(!pinned||pinned.includes(e.id))&&e.capabilities.includes(state.category)&&!(state.category==='general'&&e.knowledge)&&this.plane.policy(e.id).state==='allowed'&&this.plane.policy(e.id).capabilities.includes(state.category)).map(e=>({id:e.id,reason:this.plane.eligible(e,state)})).filter(e=>e.reason);
  const excluded=excludedSources.map(e=>e.reason);
  const knowledge=state.category==='general'&&state.page===1&&process.env.XTEND_KNOWLEDGE!=='0'?this.plane.plan(knowledgeState).slice(0,1):[];
  const fullPlan=[...plan,...knowledge.filter(k=>!plan.some(e=>e.id===k.id))].slice(0,4),imageGeneration=randomUUID(),seen=new Map();let results=[],boxes=[],dispatches=0,completed=0,failed=0,contributing=0,skipped=0,knowledgeStatus=knowledge.length?'pending':'not_applicable',fallbackUsed=false;
  const warnings=[];const addWarning=(id,message)=>{if(!warnings.some(w=>w.id===id))warnings.push({id,domId:`search-warning-${id}`,type:'warning',message});};
  for(const source of excludedSources)addWarning('excluded-'+encodeURIComponent(source.id),sourceSkippedMessage(source.id,source.reason));
  if(pinned&&plan.length<pinned.length)addWarning('coverage','Ein Teil des ursprünglichen Quellenplans ist derzeit gesperrt oder unterstützt diese Seite nicht.');
  const snapshot=(finished=false)=>{
   const raw={results,infoboxes:boxes,unresponsive_engines:[],xtend:{schema:'searxng-xtend.core.v1',paging:false,fixture:process.env.XTEND_TEST_FIXTURE==='1'}};
   const data={...normalizeResults(raw,state,{imageGeneration}),...{standalone:true,searchRole:'search',tabs:this.base(state).tabs,classicUrl:'/',knowledgeStatus,safeSearchNotice:warnings.some(w=>w.id.startsWith('safesearch-'))?'SafeSearch gilt nicht für alle Quellen. Administrative Ausnahmen: '+warnings.filter(w=>w.id.startsWith('safesearch-')).map(w=>w.id.slice(11)).join(', ')+'. Ungefilterte Inhalte sind möglich.':'',warnings:[...warnings]}};
   // This executor owns signed continuations. Drop the legacy normalizer's
   // numeric previous-page link before constructing the standalone controls.
   for(const [index,row]of data.results.entries()){
    const raw=results[index];row.favicon=this.features.favicons?.sign(row.url)||'';
    row.reportTicket=this.features.quality?.ticket(row.url,raw.engines,state.category,imageGeneration+row.id)||'';
    row.reportUrl=row.reportTicket?'/feedback?ticket='+row.reportTicket:'';
   }
   for(const [index,card]of data.knowledgeCards.entries()){
    card.reportTicket=this.features.quality?.ticket(card.links[0]?.url,boxes[index].xtend_engines||[],'knowledge',imageGeneration+card.id)||'';
    card.reportUrl=card.reportTicket?'/feedback?ticket='+card.reportTicket:'';
   }
   data.pages=[];
   data.skeleton=false;data.hasKnowledge=boxes.length>0;data.showKnowledge=knowledge.length>0;data.knowledgeMessage=({pending:'Zusatzinformationen werden geprüft …',not_found:'Keine gesicherten Zusatzinformationen gefunden.',ambiguous:'Die Anfrage ist mehrdeutig. Es wird keine Zuordnung vermutet.',temporarily_unavailable:'Zusatzinformationen sind vorübergehend nicht verfügbar.',available:'Quellen und Lizenzangaben: siehe verlinkte Originalquelle.'})[knowledgeStatus]||'';
   data.statusLabel=finished?`${contributing} von ${fullPlan.length} Quellen mit Treffern${failed?` · ${failed} fehlgeschlagen`:''}${skipped?` · ${skipped} nicht ausgeführt`:''}${excludedSources.length?` · ${excludedSources.length} weitere nicht berücksichtigt`:''}`:`${completed} von ${fullPlan.length} Quellen abgeschlossen · ${contributing} mit Treffern · Suche läuft …`;
   data.countLabel=`${data.results.length} Ergebnisse${finished?'':' · Suche läuft …'}`;
   if(!finished){data.pages=[];data.empty=false;data.error=false;}
   else{
    if(!dispatches||(!results.length&&failed>0)){data.error=true;data.empty=false;data.errorMessage=!dispatches?unavailableMessage(excluded):'Die angefragten Suchquellen haben keine verwertbare Antwort geliefert. Bitte später erneut versuchen.';data.countLabel='Suche derzeit nicht verfügbar';}
    const paging=plan.filter(e=>e.paging&&this.plane.policy(e.id).pagingVerified);
    if(paging.length&&results.length&&state.page<100)data.pages.push({id:'next',label:'Nächste Seite →',rel:'next',url:searchUrl(state,{page:state.page+1,continuation:this.sign(plan,state,state.page+1)})});
    if(state.page>1)data.pages=[{id:'previous',label:'← Zurück zur ersten Seite',rel:'prev',url:searchUrl(state,{page:1,continuation:''})},...data.pages];
   }
   return data;
  };
  const pending=new Map();let sequence=0;
  const dispatch=async(engine,lane)=>{
   if(combined.aborted)return {engine,lane,result:null,reason:'cancelled'};
   const input=lane==='knowledge'?knowledgeState:state,reservation=await this.plane.reserve(engine,input);
    if(reservation.reason){if(lane==='results')excluded.push(reservation.reason);return {engine,lane,result:null,reason:reservation.reason};}
   if(combined.aborted){reservation.release();return {engine,lane,result:null,reason:'cancelled'};}
   dispatches++;
   const dispatchInput=reservation.safeSearchBypassed?{...input,safeSearch:'0'}:input;
   if(reservation.safeSearchBypassed)addWarning('safesearch-'+engine.id,`${engine.id}: Diese Quelle liefert aufgrund einer administrativen Ausnahme Inhalte ohne SafeSearch-Filter.`);
   const deadline=AbortSignal.timeout(engine.timeout),engineSignal=AbortSignal.any([combined,deadline]);
   try{const result=await this.plane.adapter.execute(engine,dispatchInput,engineSignal);if(result.outcome==='cancelled'&&!combined.aborted)result.outcome='error';await this.plane.observe(engine,input,result);return {engine,lane,result};}
   finally{if(combined.aborted){setTimeout(reservation.release,engine.timeout).unref();}else reservation.release();}
  };
  const start=(engine,lane)=>{const id=++sequence;pending.set(id,dispatch(engine,lane).then(value=>({id,...value})));};
  try{
   yield {event:'search.started',data:snapshot()};
   for(const e of fullPlan){if(combined.aborted)break;start(e,knowledge.some(k=>k.id===e.id)?'knowledge':'results');}
   while(pending.size){
    const {id,engine,lane,result,reason}=await Promise.race(pending.values());pending.delete(id);if(combined.aborted){if(total.aborted&&!signal?.aborted){addWarning('deadline','Die Suchfrist ist erreicht. Bereits geladene Treffer bleiben erhalten.');yield {event:'search.summary',data:snapshot(true)};}return;}completed++;
    if(reason){skipped++;addWarning('capacity-'+encodeURIComponent(engine.id),sourceSkippedMessage(engine.id,reason));}
    if(result?.outcome==='error'){failed++;addWarning('source-'+encodeURIComponent(engine.id),sourceFailureMessage(engine.id,result.errorClass));}
    if(result&&['success','empty'].includes(result.outcome)){
     if(result.results.length)contributing++;
     for(const r of result.results){
      const u=new URL(r.url);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_(source|medium|campaign|term|content)$/.test(key))u.searchParams.delete(key);
      const identity=u.href+(state.category==='images'?':'+r.img_src:''),existing=seen.get(identity);
      // Keep row identity, position and content from the first answer, but
      // retain every actual dispatch that independently returned this hit.
      if(existing){existing.engines=[...new Set([...existing.engines,engine.id])].sort();continue;}
      if(results.length>=100)continue;const record={...r,url:u.href,engines:[engine.id],xtend_thumbnail:this.media.sign(r.thumbnail_src||r.thumbnail||r.img_src),xtend_image:this.media.sign(r.img_src)};seen.set(identity,record);results.push(record);
     }
     if(lane==='knowledge'){
      const candidates=result.infoboxes.filter(b=>typeof b.infobox==='string'&&Array.isArray(b.urls)&&b.urls.some(l=>allowedUrl(l.url)));
      // Preserve a provider's single entity. Multiple candidates are ambiguous;
      // never invent equivalence, merge conflicting fields or reuse stale cards.
      if(candidates.length===1){if(!result.results.length)contributing++;const b=candidates[0];boxes=[{...b,xtend_engines:[engine.id],infobox:plain(b.infobox,300),xtend_content_text:plain(b.content,5000),xtend_image:this.media.sign(b.img_src),attributes:(b.attributes||[]).slice(0,20).map(f=>({...f,xtend_value_text:plain(f.value),xtend_image:this.media.sign(f.image?.src)}))}];knowledgeStatus='available';}
      else knowledgeStatus=candidates.length>1?'ambiguous':'not_found';
     }
    }else if(lane==='knowledge'){
     knowledgeStatus='temporarily_unavailable';
     if(!fallbackUsed&&dispatches<5&&!combined.aborted&&Date.now()-started<10000){
      const fallback=this.plane.plan(knowledgeState,null,5).find(e=>e.id!==engine.id&&!fullPlan.some(x=>x.id===e.id)&&(this.plane.policy(e.id).family!==this.plane.policy(engine.id).family||['schema_invalid','wrong_result_type'].includes(result?.errorClass)));
      if(fallback){fallbackUsed=true;fullPlan.push(fallback);start(fallback,'knowledge');}
     }
    }
    yield {event:lane==='knowledge'?'knowledge.updated':result?.results.length?'results.batch':'source.status',data:snapshot()};
   }
   if(results.length>=100)addWarning('limit','Die Darstellung ist auf 100 Ergebnisse pro Seite begrenzt.');
   yield {event:'search.summary',data:snapshot(true)};
  }finally{controller.abort();this.active--;}
 }
 async load(state,context){let data=this.base(state);for await(const event of this.run(state,context))data=event.data;return data;}
}
