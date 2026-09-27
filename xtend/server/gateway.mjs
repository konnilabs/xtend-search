import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createGzip} from 'node:zlib';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'public/assets/xtend');
const nodePort=Number(process.env.XTEND_NODE_PORT || 8081),corePort=Number(process.env.XTEND_CORE_PORT || 8082);
const publicPort=Number(process.env.PORT || 8080);
const MIME={'.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function failure(req,res,status=503){
 if(res.headersSent){res.destroy();return;}
 res.writeHead(status,{'Content-Type':req.headers['x-xtend-page']?'application/json':'text/html; charset=utf-8','Cache-Control':'no-store'});
 if(req.headers['x-xtend-page'])res.end(JSON.stringify({error:'search.unavailable'}));
 else {
  const query=new URL(req.url,'http://localhost').search;
  res.end(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>XTend.search</title><link rel="stylesheet" href="/assets/xtend/search.css"><main class="empty-state"><img src="/assets/xtend/mark.svg" width="48" height="48" alt=""><h1>XTend.search</h1><p>Die Suchoberfläche ist gerade nicht erreichbar.</p><a href="/classic/search${escape(query)}">Klassische Suche öffnen</a></main></html>`);
 }
}
function sendStream(req,res,stream,headers,status=200){
 const streaming=(headers['content-type'] || '').includes('application/x-ndjson');
 const compress=!streaming && req.method!=='HEAD' && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /text|javascript|json|svg/.test(headers['content-type'] || '');
 if(streaming)headers['x-accel-buffering']='no';
 delete headers['transfer-encoding'];delete headers.connection;
 if(compress){headers['content-encoding']='gzip';delete headers['content-length'];headers.vary=[headers.vary,'Accept-Encoding'].filter(Boolean).join(', ');}
 res.writeHead(status,headers);
 if(req.method==='HEAD'){stream.destroy();res.end();return;}
 stream.on('error',()=>res.destroy());
 if(compress){const zip=createGzip();zip.on('error',()=>res.destroy());stream.pipe(zip).pipe(res);}else stream.pipe(res);
}
const corePath=p=>['/','/search','/preferences','/opensearch.xml','/favicon.ico','/image_proxy','/manifest.webmanifest'].includes(p) || /^\/info\/(?:de|en)\/(?:about|search-syntax)$/.test(p) || p.startsWith('/static/') || p.startsWith('/logo/');
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
 if(!['GET','HEAD','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
 if((req.headers['content-length'] && Number(req.headers['content-length'])>65536) || req.url.length>12000){res.writeHead(413);res.end();return;}
 let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400);res.end();return;}
 if(url.pathname==='/health/live'){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}
 if(url.pathname==='/health/ready'){
  const statuses=await Promise.allSettled([fetch(`http://127.0.0.1:${nodePort}/health`,{signal:AbortSignal.timeout(2500)}),fetch(`http://127.0.0.1:${corePort}/healthz`,{signal:AbortSignal.timeout(2500)})]);
  const node=statuses[0].status==='fulfilled'&&statuses[0].value.ok,core=statuses[1].status==='fulfilled'&&statuses[1].value.ok;
  const ok=core&&(node||process.env.FRONTEND_MODE==='classic');
  res.writeHead(ok?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok,node,core,frontend:process.env.FRONTEND_MODE || 'xtend'}));return;
 }
 if(url.pathname==='/favicon.ico'){res.writeHead(302,{Location:'/assets/xtend/mark.svg'});res.end();return;}
 if(url.pathname==='/assets/xtend/resume-key.mjs'){
  const key=fs.readFileSync(path.join(process.env.XTEND_SECRET_DIR || path.join(root,'.secrets'),'resume-public.json'),'utf8');
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':`export default ${key};`);return;
 }
 if(url.pathname==='/source.tar.gz'){
  const file=path.join(root,'..','source.tar.gz');
  if(!fs.existsSync(file)){res.writeHead(404);res.end('Quellarchiv im Container verfügbar.');return;}
  sendStream(req,res,fs.createReadStream(file),{'content-type':'application/gzip','content-disposition':'attachment; filename="xtend-search-source.tar.gz"','cache-control':'public, max-age=300'});return;
 }
 if(url.pathname.startsWith('/assets/xtend/')){
  let file;try{file=path.resolve(assets,decodeURIComponent(url.pathname.slice('/assets/xtend/'.length)));}catch{res.writeHead(400);res.end();return;}
  if(!file.startsWith(assets+path.sep) || !MIME[path.extname(file)] || file.endsWith('.map') || !fs.existsSync(file) || !fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  sendStream(req,res,fs.createReadStream(file),{'content-type':MIME[path.extname(file)],'cache-control':'public, max-age=0, must-revalidate'});return;
 }
 const serviceRoute=url.pathname==='/api/xtend/services/search.results' && !url.search;
 if(serviceRoute){
  const origin=process.env.PUBLIC_BASE_URL?new URL(process.env.PUBLIC_BASE_URL).origin:`http://${req.headers.host}`;
  if(req.method!=='POST' || !req.headers['content-type']?.startsWith('application/json')){res.writeHead(405);res.end();return;}
  if(req.headers.origin && req.headers.origin!==origin){res.writeHead(403);res.end();return;}
 }
 let port=nodePort,requestPath=req.url;
 const classic=url.pathname.startsWith('/classic/') || url.pathname==='/classic';
 const coreRoute=classic || /^\/info\/(?:de|en)\/(?:about|search-syntax)$/.test(url.pathname) || url.pathname.startsWith('/static/') || url.pathname==='/image_proxy';
 if(classic && !corePath(url.pathname.slice(8)||'/')){res.writeHead(404);res.end();return;}
 if(coreRoute)port=corePort;
 else if(process.env.FRONTEND_MODE==='classic' && corePath(url.pathname))port=corePort;
 else if(req.method==='POST' && url.pathname==='/search'){port=corePort;requestPath='/classic/search'+url.search;}
 else if(!serviceRoute && !['/','/search'].includes(url.pathname)){res.writeHead(404);res.end('Nicht gefunden.');return;}
 if(url.searchParams.has('format') && url.searchParams.get('format')!=='html'){res.writeHead(403);res.end('Dieses Ausgabeformat ist nicht freigegeben.');return;}
 let body;
 if(req.method==='POST'){
  if(!serviceRoute && (port!==corePort || !['/search','/classic/search','/preferences','/classic/preferences'].includes(url.pathname) || !req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))){res.writeHead(405);res.end();return;}
  const chunks=[];let size=0;
  try{for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end();return;}chunks.push(chunk);}}catch{return;}
  body=Buffer.concat(chunks);
  if(!serviceRoute){const form=new URLSearchParams(body.toString('utf8'));if(form.has('format')&&form.get('format')!=='html'){res.writeHead(403);res.end();return;}}
 }
 const headers={};
 for(const name of ['accept','accept-language','content-type','x-xtend-page','x-xtend-page-wire','x-xtend-version','x-xtend-context','x-xtend-only','x-xtend-deferred','x-xtend-once','x-xtend-stream'])if(req.headers[name])headers[name]=req.headers[name];
 if(body)headers['content-length']=String(body.length);
 const peer=req.socket.remoteAddress?.replace(/^::ffff:/,'') || '127.0.0.1';
 const trusted=(process.env.TRUSTED_PROXY_IPS || '').split(',').includes(peer);
 const claimed=trusted?String(req.headers['x-real-ip'] || ''):'';
 const ip=claimed && /^[a-f\d.:]+$/i.test(claimed)?claimed:peer;
 headers['x-forwarded-for']=ip;headers['x-real-ip']=ip;
 const publicUrl=process.env.PUBLIC_BASE_URL?new URL(process.env.PUBLIC_BASE_URL):null;
 headers.host=publicUrl?.host || (/^[a-z\d.\-:[\]]+$/i.test(req.headers.host || '')?req.headers.host:`localhost:${publicPort}`);
 if(publicUrl)headers['x-forwarded-proto']=publicUrl.protocol.slice(0,-1);
 if(port===corePort && req.headers.cookie)headers.cookie=req.headers.cookie;
 const upstream=http.request({hostname:'127.0.0.1',port,path:requestPath,method:req.method,headers,timeout:17000},reply=>{
  const out={...reply.headers,'cache-control':coreRoute&&url.pathname.includes('/static/')?'public, max-age=300':'private, no-store','referrer-policy':'no-referrer'};
  if(out.location)out.location=String(out.location).replace(`http://127.0.0.1:${port}`,'');
  if(out['set-cookie'])out['set-cookie']=out['set-cookie'].map(c=>c.replace(/; Path=\/($|;)/i,'; Path=/classic$1'));
  sendStream(req,res,reply,out,reply.statusCode);
 });
 upstream.on('timeout',()=>upstream.destroy(new Error('timeout')));upstream.on('error',()=>failure(req,res));
 req.on('aborted',()=>upstream.destroy());res.on('close',()=>{if(!res.writableEnded)upstream.destroy();});
 upstream.end(body);
});
server.headersTimeout=20000;server.requestTimeout=22000;
server.listen(publicPort,process.env.BIND_HOST || '127.0.0.1',()=>console.log(`XTend.search gateway ready on ${publicPort}.`));
const stop=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
