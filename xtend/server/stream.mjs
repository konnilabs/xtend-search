import {service,defineServerServices} from '@ccslabs/xtend/maraca/app-services';
import {createNodeAppServiceHost} from '@ccslabs/xtend/maraca/node-app-service-host';
import {parseSearch,searchUrl,normalizeResults,safeUrl} from './search.mjs';
import {randomUUID} from 'node:crypto';

// Only the Python bridge is private. Public framing, IDs, sequencing, backpressure
// and terminal/error semantics are produced by XTend's real AppService host.
export async function* searchFrames(input,context,{coreOrigin=process.env.XTEND_CORE_ORIGIN || 'http://127.0.0.1:8082'}={}){
 const imageGeneration=randomUUID();
 if(typeof input?.url!=='string' || !input.url.startsWith('/search?') || input.url.length>12000)throw new Error('Ungültige Suchanfrage.');
 const state=parseSearch(new URL(input.url,'http://localhost'));
 if(!state.q.trim())throw new Error('Ein Suchbegriff fehlt.');
 const url=new URL(searchUrl(state),coreOrigin);url.searchParams.set('format','json');
 const signal=AbortSignal.any([context.signal,AbortSignal.timeout(12000)]);
 const response=await fetch(url,{signal,redirect:'manual',headers:{'X-SearXNG-XTend-Contract':'1','X-SearXNG-XTend-Stream':'1','X-Forwarded-For':context.clientIp || '127.0.0.1','Accept':'application/x-ndjson'}});
 if(!response.ok || !response.headers.get('content-type')?.includes('application/x-ndjson'))throw new Error('Der Suchstream ist nicht verfügbar.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',total=0,terminal=false;
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   total+=value.byteLength;if(total>16*1024*1024)throw new Error('Der Suchstream überschreitet das Größenlimit.');
   buffer+=decoder.decode(value,{stream:true});
   if(Buffer.byteLength(buffer)>4*1024*1024)throw new Error('Ein Suchframe überschreitet das Größenlimit.');
   let end;
   while((end=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;
    const item=JSON.parse(line);
    if(item.kind==='start' || item.kind==='ping')continue;
    if(item.kind==='error')throw new Error('Die Suche konnte nicht abgeschlossen werden.');
    if(!['snapshot','complete'].includes(item.kind))throw new Error('Unbekannter Suchframe.');
    if(item.redirect){const redirect=safeUrl(item.redirect);if(!redirect)throw new Error('Ungültiges Suchziel.');yield {type:'complete',value:{redirect}};terminal=true;return;}
    const data=normalizeResults(item.data,state,{imageGeneration});
    if(item.kind==='snapshot'){
     data.pages=[];data.empty=false;data.error=false;data.errorMessage='';data.warnings=[];
     data.countLabel=`${data.results.length} Ergebnisse · Suche läuft …`;
     yield {type:'delta',value:data};
    }else{yield {type:'complete',value:data};terminal=true;return;}
   }
  }
  if(!terminal)throw new Error('Die Verbindung endete vor Abschluss der Suche.');
 }finally{await reader.cancel().catch(()=>{});}
}

export function createSearchStreamHost(){
 return createNodeAppServiceHost({
  services:defineServerServices({'search.results':service({kind:'stream',target:'server',concurrency:'parallel',stream:searchFrames})}),
  pathPrefix:'/api/xtend/services',bodyLimit:16384,historyLimit:0,
  createContext:request=>({clientIp:request.headers['x-real-ip'] || '127.0.0.1'}),
 });
}
