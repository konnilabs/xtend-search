import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as xmlLibrary from 'fast-xml-parser';
// Works with the package ESM export and the compiler's Node CJS boundary.
const {XMLParser,XMLValidator}=xmlLibrary.default||xmlLibrary;
import {readZip} from './zip.mjs';
const list=v=>v==null?[]:Array.isArray(v)?v:[v],text=v=>typeof v==='string'?v.slice(0,16000):'',num=v=>Number(v);
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,trimValues:true,processEntities:true});
export function pointInRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(Math.abs((x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]))<1e-10&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]))return true;if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function pointInGeometry(point,geometry){if(!geometry)return false;const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];return polys.some(r=>pointInRing(point,r[0])&&!r.slice(1).some(h=>pointInRing(point,h)));}
const ring=value=>{const points=text(value).split(/\s+/).map(pair=>pair.split(',').map(Number));if(points.length<4||points.some(p=>p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>90||Math.abs(p[1])>180)||points[0][0]!==points.at(-1)[0]||points[0][1]!==points.at(-1)[1])return null;return points.map(([lat,lon])=>[lon,lat]);};
export function parseDwd(bytes,now=Date.now()){
 const alerts=[],messages=[];let sent=0,incomplete=false;for(const [name,raw]of readZip(bytes)){
  if(!name.endsWith('.xml'))continue;const xml=raw.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('xml_invalid');const a=parser.parse(xml).alert;if(!a)throw Error('xml_invalid');sent=Math.max(sent,Date.parse(a.sent)||0);
  if(a.status!=='Actual'||a.scope!=='Public')continue;messages.push({messageType:a.msgType,references:text(a.references)});
  for(const info of list(a.info).filter(i=>!i.language||i.language.toLowerCase().startsWith('de'))){
   const until=Date.parse(info.expires)||0;if(!until||!list(info.area).length)incomplete=true;const start=Date.parse(info.onset||info.effective||a.sent)||0;if(until&&until<=now)continue;
   alerts.push({id:text(a.identifier),messageType:text(a.msgType),references:text(a.references),sent:Date.parse(a.sent)||0,start,until,event:text(info.event),headline:text(info.headline)||text(info.event),description:text(info.description),instruction:text(info.instruction),severity:text(info.severity),url:'https://www.dwd.de/warnungen',areas:list(info.area).map(area=>({polygons:list(area.polygon).map(value=>{const r=ring(value);if(!r)incomplete=true;return r;}).filter(Boolean),holes:list(area.geocode).filter(g=>g.valueName==='EXCLUDE_POLYGON').map(g=>{const r=ring(g.value);if(!r)incomplete=true;return r;}).filter(Boolean),ids:list(area.geocode).filter(g=>g.valueName==='WARNCELLID').map(g=>String(g.value))}))});
  }
 }
 // Full snapshots replace the previous state; explicit references retire old versions.
 const removed=new Set(messages.filter(a=>['Cancel','Update'].includes(a.messageType)).flatMap(a=>a.references.split(/\s+/).map(r=>r.split(',')[1]).filter(Boolean)));
 return {sent,incomplete,alerts:alerts.filter(a=>a.messageType!=='Cancel'&&!removed.has(a.id))};
}
export class DwdService {
 constructor({fetchImpl=fetch,now=Date.now,geometryFile=process.env.XTEND_DWD_GEOMETRIES||'xtend/vendor-inputs/dwd/warncells.json',url=process.env.XTEND_TEST_FIXTURE==='1'&&process.env.XTEND_DWD_FIXTURE_URL||'https://opendata.dwd.de/weather/alerts/cap/COMMUNEUNION_EVENT_STAT/Z_CAP_C_EDZW_LATEST_PVW_STATUS_PREMIUMEVENT_COMMUNEUNION_DE.zip'}={}){this.fetch=fetchImpl;this.now=now;this.snapshot=null;this.next=0;this.pending=null;this.geometries=null;this.geometryFile=geometryFile;this.url=url;}
 async refresh(signal){
  if(this.now()<this.next&&!this.pending)return this.snapshot;
  if(!this.pending){this.next=this.now()+300000;this.pending=(async()=>{try{const res=await this.fetch(this.url,{signal:AbortSignal.timeout(4000),headers:{Accept:'application/zip'}});if(!res.ok)throw Error('dwd_unavailable');const reader=res.body.getReader();let size=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw Error('archive_limit');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=Buffer.concat(parts.map(p=>Buffer.from(p))),parsed=parseDwd(bytes,this.now()),published=Date.parse(res.headers.get('last-modified'))||parsed.sent;this.failed=false;this.snapshot={...parsed,fetched:this.now(),published,version:createHash('sha256').update(bytes).digest('hex')};}catch{this.failed=true;}finally{this.pending=null;}return this.snapshot;})();}
  if(signal?.aborted)throw signal.reason;return this.pending;
 }
 async forLocation(place,signal){
  if(place.countryCode!=='DE')return {status:'not_covered',message:'Amtliche Warnungen sind derzeit nur für Deutschland verfügbar.',rows:[],version:'none',expiresAt:this.now()+300000};
  await this.refresh(signal);signal?.throwIfAborted();const data=this.snapshot;
  if(!data||this.now()-data.fetched>600000)return {status:'unavailable',message:'Der amtliche Warnstand ist derzeit nicht verfügbar.',rows:[],version:'unavailable',expiresAt:this.now()+60000};
  if(!this.geometries)try{this.geometries=JSON.parse(fs.readFileSync(this.geometryFile,'utf8'));}catch{this.geometries={};}
  const point=[place.longitude,place.latitude],rows=[];let incomplete=data.incomplete;
  for(const alert of data.alerts){if(alert.until&&alert.until<=this.now())continue;let match=false;for(const area of alert.areas){if(area.polygons.length){if(area.polygons.some(p=>pointInRing(point,p))&&!area.holes.some(h=>pointInRing(point,h)))match=true;}else{if(!area.ids.length)incomplete=true;for(const id of area.ids){const g=this.geometries[id];if(!g)incomplete=true;else if(pointInGeometry(point,g))match=true;}}}
   if(match)rows.push({...alert,id:alert.id,title:alert.headline,severityLabel:'Schweregrad: '+(({Minor:'Leicht',Moderate:'Erhöht',Severe:'Schwer',Extreme:'Extrem'})[alert.severity]||'Nicht angegeben'),type:['Severe','Extreme'].includes(alert.severity)?'error':'warning',period:new Intl.DateTimeFormat('de-DE',{timeZone:place.timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(alert.start))+(alert.until?' – '+new Intl.DateTimeFormat('de-DE',{timeZone:place.timezone,dateStyle:'short',timeStyle:'short'}).format(new Date(alert.until)):'')});
  }
  const stale=this.failed||this.now()-data.fetched>300000||!data.published||this.now()-data.published>900000;return {status:stale?'stale':incomplete?'partial':rows.length?'active':'clear',message:stale?'Der Warnstand konnte nicht aktualisiert werden.':incomplete?'Die Warnlage ist nur teilweise räumlich zuordenbar.':rows.length?'Amtliche Warnungen des Deutschen Wetterdienstes':'Keine aktiven amtlichen Warnungen für diesen Ort.',rows,version:data.version,expiresAt:Math.min(data.fetched+300000,data.published+900000,...rows.filter(r=>r.until).map(r=>r.until))};
 }
}
