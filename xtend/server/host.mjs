import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {sign,createHash,createPublicKey,randomUUID} from 'node:crypto';
import {createNodePageHost} from '@ccslabs/xtend/rmt/node-page-host';
import {parseSearch,baseData,loadSearch,searchUrl} from './search.mjs';
import {createSearchStreamHost} from './stream.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.xtend-build/pages.json')));
const secretDir=process.env.XTEND_SECRET_DIR || path.join(root,'.secrets');
const key=fs.readFileSync(path.join(secretDir,'resume-private.pem'));
const publicKey=JSON.parse(fs.readFileSync(path.join(secretDir,'resume-public.json')));
const actual=createPublicKey(key).export({format:'jwk'});
if(actual.x!==publicKey.x || actual.y!==publicKey.y)throw new Error('Resume key does not match the build.');
const pages=createNodePageHost({
 manifest,compactResponses:true,timeoutMs:15000,
 createContext:request=>({contextKey:'xtend-search-public-'+manifest.version,origin:'http://localhost',clientIp:request.headers['x-real-ip'] || '127.0.0.1'}),
 resolvePage:async context=>{
  const url=new URL(context.request.url,'http://localhost');
  if(!['/','/search'].includes(url.pathname))return null;
  let state,data,status=200;
  try{
   state=parseSearch(url);
   const stream=process.env.XTEND_STREAMING!=='0' && state.q.trim() && context.request.headers['x-xtend-page']==='1' && context.request.headers['x-xtend-page-wire']==='1' && context.request.headers['x-xtend-stream']!=='off' && !context.selection.only && !context.selection.deferred;
   data=stream?{...baseData(state),skeleton:true,countLabel:'Suche läuft …',stream:{id:randomUUID(),url:searchUrl(state),phase:'pending'}}:await loadSearch(state,{signal:context.signal,coreOrigin:process.env.XTEND_CORE_ORIGIN,clientIp:context.clientIp});
   if(data.redirect)return {redirect:data.redirect,status:302};
  }
  catch(error){
   if(context.signal.aborted)throw error;
   state=state || {q:(url.searchParams.get('q') || '').slice(0,2048),category:'general',language:'all',timeRange:'',safeSearch:'1',page:1};
   data={...baseData(state),isSearch:true,view:'results',error:true,errorMessage:error.message,countLabel:error.status===400?'Ungültige Suche':'Suche derzeit nicht verfügbar'};
   status=error.status===400?400:error.status===429?429:503;
  }
  if(data.state)state=data.state;
  // A single public preference context: no cookies, once-props or user-specific data.
  return {page:'Search',url:searchUrl(state),status,props:{'search.data':data,'search.query':state.q},head:[
   {tag:'title',text:state.q?`${state.q} · XTend.search`:'XTend.search — Dein Fenster ins Web'},
   {tag:'meta',attributes:{name:'viewport',content:'width=device-width, initial-scale=1'}},
   {tag:'meta',attributes:{name:'description',content:'Mehrere Suchquellen. Keine Analyse-Tracker. Deine Suche mit XTend.search.'}},
   {tag:'meta',attributes:{name:'referrer',content:'no-referrer'}},
   {tag:'meta',attributes:{name:'robots',content:'noindex, noarchive'}}
  ],renderOptions:{executionMode:'server_prerender_resume',resume:{sign:canonical=>({algorithm:'ECDSA-P256-SHA256',keyId:publicKey.kid,signature:sign('sha256',Buffer.from(canonical),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')})}}};
 },
 onError:error=>console.error(JSON.stringify({event:'page-error',code:error.code || error.name}))
});
const streams=createSearchStreamHost();
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 // Document metadata only; the body and all surface rendering remain XTend-owned.
 const end=res.end;
 res.end=function(chunk,...args){if(typeof chunk==='string' && String(res.getHeader('Content-Type')).startsWith('text/html'))chunk=chunk.replace('<html>','<html lang="de">').replace('</head>','<link rel="icon" href="/assets/xtend/mark.svg" type="image/svg+xml"></head>');return end.call(this,chunk,...args);};
 if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,version:manifest.version}));return;}
 if(req.url==='/api/xtend/services/search.results'){
  if(process.env.XTEND_STREAMING==='0'){res.writeHead(404);res.end();return;}
  res.setHeader('X-Accel-Buffering','no');await streams.handle(req,res);return;
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 if(!await pages.handle(req,res)){res.writeHead(404);res.end('Nicht gefunden.');}
});
server.headersTimeout=20000;server.requestTimeout=20000;
server.listen(Number(process.env.XTEND_NODE_PORT || 8081),'127.0.0.1',()=>console.log('XTend.search page host ready.'));
const stop=()=>{streams.dispose();pages.dispose();server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
