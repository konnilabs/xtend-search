import {FEEDBACK_REASONS,QUALITY_DEFAULTS} from '../../shared/feedback.mjs';
const views={overview:'Übersicht',sources:'Quellen',reports:'Meldungen',rules:'Regeln',events:'Ereignisse',audit:'Audit'};
const date=n=>n?new Date(n).toLocaleString('de-DE'):'–';
export function dashboard(plane,snapshot,base,input,requested){
 const view=Object.hasOwn(views,input.view)?input.view:requested?'sources':'overview',status=['allowed','disabled','paused'].includes(input.status)?input.status:'';
 const filters={...base.filters,view,status,page:Math.max(1,Math.min(100,parseInt(input.page)||1))};
 const url=(patch={})=>{const p=new URLSearchParams({...filters,engine:requested||'',capability:input.capability||'',proposal:input.proposal||'',...patch});for(const [k,v]of p)if(!v||v==='1'&&k==='page')p.delete(k);return '/admin?'+p;};
 const quality=plane.quality,state=quality?.state||{proposals:[],counts:[],rules:[],pauses:[]},now=quality?.now()||Date.now();
 const matched=base.engines.filter(e=>{const p=snapshot.engines.find(x=>x.id===e.id).policy;return !status||(status==='paused'?state.pauses.some(x=>x.engine===e.id&&x.until>now):p.state===status);});
 const page=Math.min(filters.page,Math.max(1,Math.ceil(matched.length/25)));filters.page=page;
 const selected=base.selected,capability=base.engine.capabilities.includes(input.capability)?input.capability:base.engine.capabilities[0]||'';
 const proposal=state.proposals.find(p=>p.id===input.proposal&&p.engine===selected&&p.capability===capability);
 const aggregate=(id,cap)=>state.counts.filter(c=>c.engine===id&&c.capability===cap);
 const count=(id,cap)=>aggregate(id,cap).reduce((n,c)=>n+c.total,0);
 const distribution=(id,cap)=>aggregate(id,cap).map(c=>FEEDBACK_REASONS[c.reason]+': '+c.total).join(' · ')||'Keine Meldungen';
 const pause=quality?.pause(selected,capability),rule=quality?.rule(selected,capability)||QUALITY_DEFAULTS;
 const stats=quality?.stats(selected,capability,now-rule.windowMinutes*60000,true)||{count:0,contexts:0};
 const proposals=state.proposals.slice().sort((a,b)=>(a.status==='pending'?-1:1)-(b.status==='pending'?-1:1)||b.created-a.created);
 const pending=proposals.filter(p=>p.status==='pending'),pauses=state.pauses.filter(p=>p.until>now);
 return {view,filters,url:url(),panelOpen:!!requested&&base.hasEngine,closePanelUrl:url({engine:'',capability:'',proposal:''}),capability,proposalId:proposal?.id||'',
  views:Object.keys(views).map(id=>({id,label:views[id],url:'/admin?view='+id,current:id===view?'page':'false'})),
  showOverview:view==='overview',showSources:view==='sources',showReports:view==='reports',showRules:view==='rules',showEvents:view==='events',showAudit:view==='audit',
  showCatalog:view==='sources'||view==='rules',showPolicy:view==='sources',showQuality:view==='reports'||view==='rules',
  statusOptions:[['','Alle Zustände'],['allowed','Freigegeben'],['disabled','Gesperrt'],['paused','Qualitätspause']].map(([id,label])=>({id,label,selected:id===status})),
  engines:matched.slice((page-1)*25,page*25).map(e=>({...e,url:url({engine:e.id,proposal:'',capability:''}),count:state.counts.filter(c=>c.engine===e.id).reduce((n,c)=>n+c.total,0),detail:e.detail})),
  poolCount:matched.length+' passende Quellen · Seite '+page+' von '+Math.max(1,Math.ceil(matched.length/25)),
  emptyPool:!matched.length,resetUrl:'/admin?view='+view,
  pagination:[...(page>1?[{id:'previous',label:'← Zurück',url:url({page:page-1,engine:''})}]:[]),...(page*25<matched.length?[{id:'next',label:'Weiter →',url:url({page:page+1,engine:''})}]:[])],
  qualitySummary:[{id:'proposals',label:'Offene Prüfvorschläge',value:String(pending.length),url:'/admin?view=reports'},{id:'pauses',label:'Aktive Qualitätspausen',value:String(pauses.length),url:'/admin?view=rules'}],
  proposals:proposals.map(p=>({id:p.id,label:p.engine+' · '+p.capability,status:p.status,time:date(p.created),kind:p.kind==='disable'?'Dauerhafte Überprüfung / Sperrung prüfen':'Qualität prüfen',distribution:distribution(p.engine,p.capability),count:count(p.engine,p.capability),evidenceLabel:aggregate(p.engine,p.capability).reduce((n,c)=>n+c.evidenceCount,0)+' freiwillige Belege · maximal 7 Tage',url:url({view:'reports',engine:p.engine,capability:p.capability,proposal:p.id})})),
  hasProposals:proposals.length>0,
  qualityScopes:base.engine.capabilities.map(id=>({id,label:id,url:url({capability:id,proposal:''}),current:id===capability?'page':'false'})),
  qualityRule:{...rule,...Object.fromEntries(['threshold','contexts','windowMinutes','cooldownMinutes'].map(k=>[k,String(rule[k])]))},
  qualityLabel:selected+' · '+capability,qualityDistribution:distribution(selected,capability),
  qualityWindow:'Aktuelles flüchtiges Fenster: '+stats.count+' automatisch auswertbare Meldungen / '+stats.contexts+' Browser-Kontexte. Browser-Kontexte sind kein Nachweis unabhängiger Personen.',
  qualityPause:pause?.until>now?'Qualitätspause bis '+date(pause.until):'Keine aktive Qualitätspause',
  qualityWarmup:now-(quality?.boot||now)<3600000?'Automatik sammelt seit dem Neustart ein neues vollständiges Stundenfenster.':'Beobachtungsfenster vollständig.',
  qualityCanResume:!!pause&&pause.until>now&&base.canOperate,qualityCanDecide:proposal?.status==='pending'&&base.canOperate,
  qualityTechnical:base.engine.states.find(s=>s.id===capability)?.health||'Noch nicht beobachtet',
  qualityEvents:base.telemetry.filter(e=>e.detail.includes('"engineId":"'+selected+'"')).slice(0,12),
  qualityHint:'Meldungszahlen beziehen sich auf 30 Tage; Vorschläge entstehen bei 5 Meldungen aus 3 Kontexten in 60 Minuten. Beschwerden sind keine gemessenen Providerfehler.',
  pausedSources:pauses.map(p=>({id:p.engine+':'+p.capability,label:p.engine+' · '+p.capability,detail:'bis '+date(p.until),url:'/admin?'+new URLSearchParams({view:'rules',engine:p.engine,capability:p.capability})})),
 };
}
