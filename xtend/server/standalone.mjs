import {ssrCapabilities} from './ssr-capabilities.mjs';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {sign,randomUUID,randomBytes} from 'node:crypto';
import {loginPage} from './control/login-page.mjs';
import {createGzip} from 'node:zlib';
import {createNodePageHost} from '@ccslabs/xtend/rmt/node-page-host';
import {createNodeAppServiceHost} from '@ccslabs/xtend/maraca/node-app-service-host';
import {parseSearch} from './search.mjs';
import {preferenceSearchUrl as searchUrl,withPreferences,readPreferences,validatePreferences,preferenceCookie} from './preferences.mjs';
import {adminView} from './control/admin.mjs';
import {feedbackHttp} from './control/feedback-http.mjs';
import {aboutPage} from './about.mjs';
import {VERSION} from './control/release.mjs';
import services,{initialize} from '../public/assets/xtend/standalone/maraca/server/xtend.maraca.services.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=await initialize();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.xtend-build/pages-standalone.json'))),adminManifest=JSON.parse(fs.readFileSync(path.join(root,'.xtend-build/pages-admin.json')));
const secretDir=process.env.XTEND_SECRET_DIR||path.join(root,'.secrets'),key=fs.readFileSync(path.join(secretDir,'resume-private.pem')),publicKey=JSON.parse(fs.readFileSync(path.join(secretDir,'resume-public.json')));
const renderOptions={executionMode:'server_prerender_resume',resume:{sign:canonical=>({algorithm:'ECDSA-P256-SHA256',keyId:publicKey.kid,signature:sign('sha256',Buffer.from(canonical),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')})}};
// The pinned Page head contract accepts title/meta/canonical/JSON-LD, not icons.
// Icons belong to the static document envelope, outside client-owned head nodes.
const faviconLinks='<link rel="icon" href="/assets/xtend/favicon.png" type="image/png" sizes="64x64"><link rel="icon" href="/assets/xtend/mark.svg" type="image/svg+xml" sizes="any">';
const head=(title,referrer='no-referrer')=>[{tag:'title',text:title},{tag:'meta',attributes:{name:'viewport',content:'width=device-width, initial-scale=1'}},{tag:'meta',attributes:{name:'referrer',content:referrer}},{tag:'meta',attributes:{name:'robots',content:'noindex, noarchive'}}];
const pages=createNodePageHost({manifest,ssr:ssrCapabilities,compactResponses:true,timeoutMs:16000,createContext:()=>({contextKey:'xtend-search-public-'+manifest.version,origin:app.auth.origin}),resolvePage:async context=>{
 const url=new URL(context.request.url,app.auth.origin);if(!['/','/search'].includes(url.pathname))return null;
 let state,data,status=200;
 try{
  state=parseSearch(withPreferences(url,context.request.headers.cookie));const stream=process.env.XTEND_STREAMING!=='0'&&state.q.trim()&&context.request.headers['x-xtend-page']==='1'&&context.request.headers['x-xtend-page-wire']==='1'&&context.request.headers['x-xtend-stream']!=='off';
  data=stream?{...app.search.base(state),skeleton:true,statusLabel:'Suchquellen werden angefragt …',countLabel:'Suche läuft …',stream:{id:randomUUID(),url:searchUrl(state),phase:'pending'}}:await app.search.load(state,{signal:context.signal});
 }catch(error){if(context.signal.aborted)throw error;state||={q:'',category:'general',language:'all',timeRange:'',safeSearch:'1',page:1};status=error.code==='xsearch.query'||error.code==='xsearch.cursor'?400:503;data={...app.search.base(state),view:'results',isSearch:true,error:true,errorMessage:error.expose?error.message:'Die Suchquellen sind derzeit nicht verfügbar.',countLabel:'Suche derzeit nicht verfügbar'};}
 return {page:'Search',url:searchUrl(state),status,props:{'search.data':data,'search.query':state.q,'search.filters':{language:state.language,timeRange:state.timeRange,safeSearch:state.safeSearch}},head:head(state.q?`${state.q} · XTend.search`:'XTend.search — Dein Fenster ins Web','same-origin'),renderOptions};
},onError:()=>console.error('{"event":"public-page-failed"}')});
const adminPages=createNodePageHost({manifest:adminManifest,ssr:ssrCapabilities,compactResponses:true,timeoutMs:10000,createContext:req=>({contextKey:'xtend-admin-'+app.auth.context(req).csrf,csrfToken:app.auth.context(req).csrf,origin:app.auth.origin}),resolvePage:context=>{
 const url=new URL(context.request.url,app.auth.origin);if(url.pathname!=='/admin')return null;const auth=app.auth.context(context.request),data=adminView(app.plane,auth,url.searchParams.get('engine')||'',Object.fromEntries(url.searchParams));
 return {page:'Admin',url:data.url,props:{'admin.data':data,'admin.live':data},head:[...head('Observatory · XTend.search','same-origin'),{tag:'meta',attributes:{name:'csrf-token',content:auth.csrf}}],renderOptions};
},onError:()=>console.error('{"event":"admin-page-failed"}')});
const publicServiceManifest=JSON.parse(fs.readFileSync(path.join(root,'public/assets/xtend/standalone/maraca/xtend.maraca.services.json'))),adminServiceManifest=JSON.parse(fs.readFileSync(path.join(root,'public/assets/xtend/admin/maraca/xtend.maraca.services.json')));
const hosts=new Map();for(const [kind,m]of [['public',publicServiceManifest],['admin',adminServiceManifest]])hosts.set(kind,createNodeAppServiceHost({services,manifest:m,pathPrefix:'/api/xtend/services',historyLimit:0,bodyLimit:16384,exposeErrors:false,createContext:req=>kind==='admin'?app.auth.protect(req):(req.feedbackContext||{}),onError:()=>{}}));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(res,title,text,link='/admin',label='Zurück'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · XTend.search</title><link rel="icon" href="/assets/xtend/favicon.png" type="image/png" sizes="64x64"><link rel="icon" sizes="any" href="/assets/xtend/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/xtend/standalone/search.css"><main class="empty-state"><img src="/assets/xtend/mark.svg" alt="" width="48" height="48"><h1>${escape(title)}</h1><p>${escape(text)}</p><a href="${escape(link)}">${escape(label)}</a></main></html>`);}
let ingressCount=0,ingressReset=0;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-XTend-Version',VERSION);
 const end=res.end;res.end=function(chunk,...args){if(res.statusCode>=400&&typeof chunk==='string'&&String(res.getHeader('Content-Type')).startsWith('application/json')){try{const wire=JSON.parse(chunk);if(wire.schema==='xtend.maraca.app-service-response.v1'){const code=wire.error?.code?.replace(/^xsearch\./,'');res.statusCode=({unauthenticated:401,forbidden:403,csrf:403,validation:400,query:400,cursor:400,conflict:409,readonly:403,audit_unavailable:503,probe_disabled:409,feedback_limit:429,feedback_expired:400})[code]||res.statusCode;}}catch{}}if(typeof chunk==='string'&&String(res.getHeader('Content-Type')).startsWith('text/html')){chunk=chunk.replace('<html>','<html lang="de">');if(chunk.includes('id="xtend-page-data"'))chunk=chunk.replace('<head>','<head>'+faviconLinks);}return end.call(this,chunk,...args);};
 try{
  if(req.url.length>15000||Number(req.headers['content-length']||0)>16384){res.writeHead(413);res.end();return;}
  const url=new URL(req.url,app.auth.origin),pathname=url.pathname;
  if(pathname==='/health/live'||pathname==='/health/ready'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,version:VERSION,storage:app.plane.storeOK?'ready':'unavailable',retrieval:app.adapter.status}));return;}
  if(!['GET','HEAD','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(pathname==='/preferences'){
   if(req.method==='GET'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({preferences:readPreferences(req.headers.cookie)}));return;
   }
   // Same-origin POST only; this endpoint neither grants access nor changes engine policies.
   if(req.method!=='POST'||req.headers.origin!==app.auth.origin){res.writeHead(403);res.end('Anfrage abgelehnt.');return;}
   if(!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')){res.writeHead(415);res.end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384){res.writeHead(413);res.end();return;}}
   const params=new URLSearchParams(body),action=params.get('preferenceAction');let values;
   try{if(!['save','delete'].includes(action))throw new Error('action');values=action==='save'?validatePreferences(params):null;}
   catch{res.writeHead(400);res.end('Ungültige Filtereinstellung.');return;}
   res.setHeader('Set-Cookie',preferenceCookie(values,app.auth.origin.startsWith('https:')));
   if(req.headers.accept==='application/json'){
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}));return;
   }
   // Native form fallback returns to the current query, without an open redirect.
   let target='/';try{target=searchUrl(parseSearch(new URL('/?'+params,app.auth.origin)));}catch{}
   res.writeHead(303,{Location:target});res.end();return;
  }
  if(pathname==='/admin/login'){if(req.method!=='GET'){res.writeHead(405);res.end();return;}app.auth.begin(req,res);return;}
  if(pathname==='/admin/oauth/callback'){if(req.method!=='GET'){res.writeHead(405);res.end();return;}await app.auth.callback(req,res,url);return;}
  if(pathname==='/admin/logout'){
   if(req.method!=='POST'){res.writeHead(405);res.end();return;}let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw new Error('body');}req.headers['x-csrf-token']=new URLSearchParams(body).get('csrf');app.auth.logout(req,res);return;
  }
  if(pathname==='/assets/xtend/resume-key.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`export default ${JSON.stringify(publicKey)};`);return;}
  if(pathname.startsWith('/assets/xtend/')){
   if(pathname.startsWith('/assets/xtend/admin/')&&!app.auth.session(req)){res.writeHead(401);res.end();return;}
   let part;try{part=decodeURIComponent(pathname.slice('/assets/xtend/'.length));}catch{res.writeHead(400);res.end();return;}
   if(!/^[a-zA-Z0-9_./-]+\.(?:mjs|js|css|svg|png)$/.test(part)||part.includes('..')||part.split('/').some(x=>['server','node_modules'].includes(x))){res.writeHead(404);res.end();return;}
   const file=path.join(root,'public/assets/xtend',part);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/javascript');res.setHeader('Cache-Control',part.startsWith('admin/')?'private, no-store':'public, max-age=0, must-revalidate');
   const stream=fs.createReadStream(file);if(req.method==='HEAD'){stream.destroy();res.end();return;}stream.on('error',()=>res.destroy());if(/gzip/.test(req.headers['accept-encoding']||'')){res.setHeader('Content-Encoding','gzip');res.setHeader('Vary','Accept-Encoding');stream.pipe(createGzip()).pipe(res);}else stream.pipe(res);return;
  }
  if(pathname==='/favicon'){if(req.method!=='GET'){res.writeHead(405);res.end();return;}await app.favicons.handle(req,res,url);return;}
  if(pathname==='/feedback'){await feedbackHttp(req,res,url,app);return;}
  if(pathname==='/media'){if(req.method!=='GET'){res.writeHead(405);res.end();return;}await app.media.handle(req,res,url);return;}
  if(pathname==='/source.tar.gz'){res.setHeader('Content-Type','application/gzip');res.setHeader('Content-Disposition',`attachment; filename="xtend-search-${VERSION}-source.tar.gz"`);const f=path.join(root,'../source.tar.gz');if(!fs.existsSync(f)){res.writeHead(404);res.end();return;}fs.createReadStream(f).pipe(res);return;}
  if(pathname.startsWith('/api/xtend/services/')){
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')||url.search){res.writeHead(405);res.end();return;}
   if(req.headers.origin&&req.headers.origin!==app.auth.origin){res.writeHead(403);res.end();return;}
   const id=pathname.slice('/api/xtend/services/'.length),admin=id.startsWith('admin.');
   if(!(admin?adminServiceManifest:publicServiceManifest).services.some(s=>s.id===id)){res.writeHead(404);res.end();return;}
   if(id==='search.feedback.submit')req.feedbackContext=app.quality.protect(req,res,app.auth.origin);
   if(id==='search.run'){if(ingressReset<Date.now()){ingressReset=Date.now()+60000;ingressCount=0;}if(++ingressCount>120){res.writeHead(429,{'Retry-After':'60'});res.end();return;}}
   res.setHeader('X-Accel-Buffering','no');await hosts.get(admin?'admin':'public').handle(req,res);return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  if(pathname==='/admin'){
   // Native same-origin POST (logout, including no-JS) must retain Origin;
   // no-referrer makes Chromium send Origin:null. Cross-origin referrers
   // remain suppressed, and the strict Origin + CSRF check stays intact.
   res.setHeader('Referrer-Policy','same-origin');
   if(!app.auth.session(req)){
    const nonce=randomBytes(18).toString('base64');
    // XTend 0.8.0 XButton has one static spinner style="display:none".
    // Permit that exact declaration, without allowing arbitrary inline styles.
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-hashes' 'sha256-aqNNdDLnnrDOnTNdkJpYlAxKVJtLt9CtFLklmInuUAE='; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`});
    res.end(req.method==='HEAD'?'':loginPage(nonce,app.auth.configured));return;
   }
   await adminPages.handle(req,res);return;
  }
  if(pathname==='/info/de/about'||pathname==='/info/en/about'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
   res.end(req.method==='HEAD'?'':aboutPage(pathname.includes('/en/')?'en':'de'));return;
  }
  if(['/', '/search'].includes(pathname)){res.setHeader('Referrer-Policy','same-origin');if(pathname==='/search'){if(ingressReset<Date.now()){ingressReset=Date.now()+60000;ingressCount=0;}if(++ingressCount>120){res.writeHead(429);res.end('Bitte später erneut versuchen.');return;}}await pages.handle(req,res);return;}
  res.writeHead(404);res.end('Nicht gefunden.');
 }catch(error){
  if(res.headersSent){res.destroy();return;}
  if(req.url.startsWith('/api/')){res.writeHead(error.code?.includes('unauthenticated')?401:403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.expose?error.message:'Anfrage abgelehnt.'}));}
  else message(res,'Anfrage nicht abgeschlossen',error.expose?error.message:'Der Dienst konnte die Anfrage nicht abschließen. Bitte erneut versuchen.');
 }
});
server.headersTimeout=20000;server.requestTimeout=40000;
server.listen(Number(process.env.PORT||8080),process.env.BIND_HOST||'127.0.0.1',()=>console.log(JSON.stringify({event:'xtend-search-ready',version:VERSION})));
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.close();for(const host of hosts.values())host.dispose();pages.dispose();adminPages.dispose();await app.plane.close();process.exit(0);}process.on('SIGTERM',()=>void stop());process.on('SIGINT',()=>void stop());
