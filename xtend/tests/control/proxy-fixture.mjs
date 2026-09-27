// Local-only deployment fixture: forwards to the real Docker listener and
// applies streaming gzip with an explicit flush after every upstream chunk.
import http from 'node:http';
import {createGzip,constants} from 'node:zlib';
http.createServer((req,res)=>{
 const upstream=http.request({hostname:'127.0.0.1',port:Number(process.env.FIXTURE_UPSTREAM_PORT||8096),path:req.url,method:req.method,headers:req.headers},response=>{
  const compress=response.headers['content-type']?.includes('ndjson')&&/gzip/.test(req.headers['accept-encoding']||'');
  const headers={...response.headers};if(compress){delete headers['content-length'];headers['content-encoding']='gzip';headers.vary='Accept-Encoding';}
  res.writeHead(response.statusCode,headers);
  if(compress){const zip=createGzip({flush:constants.Z_SYNC_FLUSH});response.pipe(zip).pipe(res);}else response.pipe(res);
  response.on('error',()=>res.destroy());
 });
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on('close',()=>upstream.destroy());req.pipe(upstream);
}).listen(Number(process.env.FIXTURE_PROXY_PORT||8093),'127.0.0.1',()=>console.log('Local streaming compression proxy ready.'));
