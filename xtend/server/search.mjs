import {createHash,randomUUID} from 'node:crypto';
const languages=new Set(['all','de','en']);
const times=new Set(['','day','week','month','year']);
const categories=new Set(['general','images','news','videos','music','it','science','files','social media']);
export function parseSearch(url){
 const p=url.searchParams;
 const state={q:p.get('q') || '',category:p.get('categories') || 'general',language:p.get('language') || 'all',timeRange:p.get('time_range') || '',safeSearch:p.get('safesearch') || '1',page:Number(p.get('pageno') || 1),continuation:p.get('cursor') || ''};
 if(state.q.length>2048 || state.continuation.length>4096 || !categories.has(state.category) || !languages.has(state.language) || !times.has(state.timeRange) || !['0','1','2'].includes(state.safeSearch) || !Number.isSafeInteger(state.page) || state.page<1 || state.page>100)throw Object.assign(new Error('Ungültige Suchparameter. Bitte Filter oder Suchbegriff prüfen.'),{status:400});
 return state;
}
export function searchUrl(state,patch={}){
 const s={...state,...patch};
 if(!s.q.trim()){
  // The home page also has search state: category links must keep a preselection.
  const p=new URLSearchParams();
  for(const [name,value,fallback] of [['categories',s.category,'general'],['language',s.language,'all'],['time_range',s.timeRange,''],['safesearch',String(s.safeSearch),'1']]){
   if(value!==fallback)p.set(name,value);
  }
  return '/'+(p.size?'?'+p:'');
 }
 const p=new URLSearchParams({q:s.q,categories:s.category,language:s.language,time_range:s.timeRange,safesearch:String(s.safeSearch)});
 if(s.page>1)p.set('pageno',String(s.page));
 if(s.continuation)p.set('cursor',s.continuation);
 return '/search?'+p;
}
export function safeUrl(value){
 try{const u=new URL(value);return ['http:','https:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;}catch{return null;}
}
const text=(value,max)=>String(value ?? '').slice(0,max);
const displayPath=value=>{try{return decodeURI(value).slice(0,100);}catch{return value.slice(0,100);}};
const list=value=>Array.isArray(value)?value:[];
const proxyImage=value=>typeof value==='string' && (value.startsWith('/image_proxy?') || value.startsWith('/media?'))?value:'';
export function normalizeInfoboxes(raw,state){
 const seen=new Set(),cards=[];
 for(const box of list(raw).slice(0,3)){
  if(!box || typeof box!=='object')continue;
  const title=text(box.infobox,300);if(!title)continue;
  const id=createHash('sha256').update(text(box.id || title,2048)).digest('hex').slice(0,24);
  if(seen.has(id))continue;seen.add(id);
  const links=list(box.urls).slice(0,12).flatMap((link,index)=>{
   const url=safeUrl(link?.url);return url?[{id:String(index),url,label:text(link.title || new URL(url).hostname,150)}]:[];
  });
  const facts=list(box.attributes).slice(0,20).flatMap((fact,index)=>{
   if(!fact || typeof fact!=='object')return [];
   const value=text(fact.xtend_value_text ?? (typeof fact.value==='string'?fact.value:''),1600),image=proxyImage(fact.xtend_image);
   return value || image?[{id:String(index),label:text(fact.label,150),value,image,imageAlt:text(fact.image?.alt || fact.label,300)}]:[];
  });
  const related=list(box.relatedTopics).slice(0,4).flatMap(topic=>list(topic?.suggestions).slice(0,6)).filter(q=>typeof q==='string' && q.trim()).slice(0,12).map((q,index)=>({id:String(index),label:text(q,120),url:searchUrl(state,{q:text(q,2048),page:1})}));
  cards.push({id,title,image:proxyImage(box.xtend_image),description:text(box.xtend_content_text ?? box.content,5000),facts,links,related});
 }
 return cards;
}
export function baseData(state){
 const isSearch=Boolean(state.q.trim());
 return {...state,skeleton:false,stream:null,view:isSearch?'results':'home',isSearch,results:[],knowledgeCards:[],hasKnowledge:false,warnings:[],pages:[],tabs:[['general','Web'],['images','Bilder']].map(([id,label])=>({id,label,url:searchUrl(state,{category:id,page:1}),className:'tab'+(state.category===id?' active':''),current:state.category===id?'page':'false'})),countLabel:'',pageLabel:`Seite ${state.page}`,empty:false,error:false,errorMessage:'',fixture:false,listClass:state.category==='images'?'image-results':'web-results',classicUrl:'/classic'+searchUrl(state)};
}
export function normalizeResults(raw,state,{imageGeneration=randomUUID()}={}){
 // Firefox may retain failed image requests even with HTTP no-store. A fresh
 // search needs a fresh browser resource identity; batches share one identity.
 // Only the proxy request changes: upstream URL and its HMAC remain untouched.
 const attempt=value=>{const source=proxyImage(value);return source?`${source}&xtend_attempt=${encodeURIComponent(imageGeneration)}`:'';};
 if(!raw || !Array.isArray(raw.results) || raw.xtend?.schema!=='searxng-xtend.core.v1')throw new Error('Der Such-Core liefert ein inkompatibles Datenformat.');
 const effective=raw.xtend.state;
 if(effective){
  // Preserve raw query syntax; expose supported effective filters selected by the core.
  state={...state,category:effective.categories?.length===1 && categories.has(effective.categories[0])?effective.categories[0]:state.category,language:languages.has(effective.language)?effective.language:state.language,timeRange:times.has(effective.time_range)?effective.time_range:state.timeRange,safeSearch:['0','1','2'].includes(String(effective.safesearch))?String(effective.safesearch):state.safeSearch};
 }
 const data={...baseData(state),state,knowledgeCards:normalizeInfoboxes(raw.infoboxes,state)},seen=new Set();
 data.hasKnowledge=data.knowledgeCards.length>0;
 for(const result of raw.results.slice(0,100)){
  const url=safeUrl(result.url);if(!url)continue;
  const imageUrl=safeUrl(result.img_src);
  const isImage=state.category==='images';
  const id=createHash('sha256').update(`${result.template || 'web'}:${url}${isImage?':'+(imageUrl || ''):''}`).digest('hex').slice(0,24);
  if(seen.has(id))continue;seen.add(id);
  const parsed=new URL(url);
  const thumbnail=attempt(result.xtend_thumbnail);
  const title=text(result.title || parsed.hostname,300);
  const sourceLabel=list(result.engines || [result.engine]).filter(Boolean).map(x=>text(x,50)).join(' · ');
  const previewSrc=attempt(result.xtend_image) || thumbnail;
  const metadata=[['Auflösung',result.resolution],['Format',result.img_format],['Dateigröße',result.filesize],['Urheber',result.author],['Quelle',result.source],['Suchquellen',sourceLabel]].filter(([,value])=>value).map(([label,value],index)=>({id:String(index),label,value:text(value,300)}));
  const formats=list(result.formats).slice(0,8).flatMap((format,index)=>{const link=safeUrl(format?.url);return link?[{id:String(index),url:link,label:text(format.label || format.subtype || 'Bildformat',60)}]:[];});
  data.results.push({id,url,title,displayUrl:parsed.hostname.replace(/^www\./,'')+ (parsed.pathname==='/'?'':displayPath(parsed.pathname)),snippetText:text(result.content,1600),initial:parsed.hostname.replace(/^www\./,'')[0].toUpperCase(),sourceLabel,thumbnail,thumbnailKey:`${imageGeneration}:${thumbnail}`,thumbnailAlt:title,thumbnailFailed:false,imageUrl:imageUrl || '',previewSrc,previewId:isImage && previewSrc?id:'',previewHref:isImage && imageUrl?imageUrl:url,previewLabel:isImage?`Bildvorschau: ${title}`:title,metadata,formats,resolution:text(result.resolution,80)});
 }
 data.fixture=raw.xtend.fixture===true;
 data.warnings=(raw.unresponsive_engines || []).slice(0,20).map((error,index)=>({id:`engine-${index}`,domId:`search-warning-engine-${index}`,type:'warning',message:`Eine Suchquelle antwortet derzeit nicht${Array.isArray(error)?`: ${text(error[0],60)}`:'.'}`}));
 data.error=data.results.length===0 && !data.hasKnowledge && data.warnings.length>0;
 data.empty=data.results.length===0 && !data.hasKnowledge && !data.error;
 data.errorMessage=data.error?'Die Suchquellen haben keine verwertbare Antwort geliefert. Bitte versuche es später erneut.':'';
 data.countLabel=data.error?'Suche derzeit nicht verfügbar':data.results.length===0 && data.hasKnowledge?'Informationen zur Suche':`${data.results.length} Ergebnisse auf dieser Seite`;
 if(state.page>1)data.pages.push({id:'previous',label:'← Vorherige Seite',url:searchUrl(state,{page:state.page-1}),rel:'prev'});
 if(raw.xtend.paging && data.results.length && state.page<100)data.pages.push({id:'next',label:'Nächste Seite →',url:searchUrl(state,{page:state.page+1}),rel:'next'});
 if(raw.results.length>100)data.warnings.push({id:'truncated',domId:'search-warning-truncated',type:'info',message:'Die Darstellung ist auf 100 Ergebnisse pro Seite begrenzt.'});
 return data;
}
export async function loadSearch(state,{signal,coreOrigin='http://127.0.0.1:8082',clientIp='127.0.0.1'}={}){
 if(!state.q.trim())return baseData(state);
 const url=new URL(searchUrl(state),coreOrigin);url.searchParams.set('format','json');
 const response=await fetch(url,{signal:AbortSignal.any([signal || new AbortController().signal,AbortSignal.timeout(12000)]),redirect:'manual',headers:{'X-SearXNG-XTend-Contract':'1','X-Forwarded-For':clientIp,'Accept':'application/json'}});
 if(response.status>=300 && response.status<400){const redirect=safeUrl(response.headers.get('location'));if(!redirect)throw new Error('Unsicheres Suchziel abgelehnt.');return {redirect};}
 if(!response.ok)throw Object.assign(new Error(response.status===403?'JSON ist im Such-Core nicht freigeschaltet.':'Die Suchquelle ist vorübergehend nicht erreichbar.'),{status:response.status,retryAfter:response.headers.get('retry-after')});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Ungültiger Inhaltstyp der Suchantwort.');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw new Error('Die Suchantwort überschreitet das Größenlimit.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return normalizeResults(JSON.parse(Buffer.concat(chunks).toString('utf8')),state);
}
