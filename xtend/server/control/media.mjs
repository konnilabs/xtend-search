import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {allowedUrl} from './contracts.mjs';
import {VERSION} from './release.mjs';
export function publicAddress(address){
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);}
 // Restrict IPv6 to currently global unicast; reject mapped/private/link-local.
 if(isIP(address)!==6)return false;
 const [a,b]=address.split(':').map(x=>parseInt(x||'0',16));
 return a>=0x2000&&a<=0x3fff&&a!==0x2002&&a!==0x3fff&&!(a===0x2001&&(b<0x200||b===0xdb8));
}
export class MediaProxy {
 constructor(key){this.key=key;this.active=0;this.rate={reset:0,count:0};}
 sign(value){const url=allowedUrl(value);if(!url||url.href.length>4096)return '';const exp=String(Math.floor(Date.now()/1000)+1800),u=Buffer.from(url.href).toString('base64url'),h=createHmac('sha256',this.key).update(u+'.'+exp).digest('base64url');return '/media?'+new URLSearchParams({u,exp,h});}
 async handle(req,res,url){
  const {u,exp,h}=Object.fromEntries(url.searchParams),expected=createHmac('sha256',this.key).update(`${u}.${exp}`).digest('base64url');
  if(!u||u.length>6000||!h||h.length!==expected.length||!timingSafeEqual(Buffer.from(h),Buffer.from(expected))||Number(exp)<Date.now()/1000||Number(exp)>Date.now()/1000+1900){res.writeHead(403);res.end();return;}
  if(this.rate.reset<Date.now())this.rate={reset:Date.now()+60000,count:0};
  if(this.active>=12||this.rate.count>=300){res.writeHead(429,{'Retry-After':'60'});res.end();return;}
  this.active++;this.rate.count++;const controller=new AbortController(),signal=AbortSignal.any([controller.signal,AbortSignal.timeout(8000)]);res.on('close',()=>controller.abort());
  try{
   let target=allowedUrl(Buffer.from(u,'base64url').toString());let result;
   for(let hop=0;hop<4;hop++){
    if(!target||target.port&&!['80','443'].includes(target.port))throw new Error('blocked');
    const hostname=target.hostname.replace(/^\[|\]$/g,'');signal.throwIfAborted();
    const records=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await new Promise((resolve,reject)=>{const abort=()=>reject(new Error('timeout'));signal.addEventListener('abort',abort,{once:true});dns.lookup(hostname,{all:true}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
    if(!records.length||records.some(r=>!publicAddress(r.address)))throw new Error('blocked');const address=records[0];
    result=await new Promise((resolve,reject)=>{
     const upstream=(target.protocol==='https:'?https:http).get(target,{agent:false,signal,headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif','User-Agent':`XTend.search/${VERSION} media proxy`},lookup:(name,options,callback)=>options.all?callback(null,[address]):callback(null,address.address,address.family)},resolve);upstream.on('error',reject);
    });
    if([301,302,303,307,308].includes(result.statusCode)){const location=result.headers.location;result.destroy();target=allowedUrl(new URL(location,target).href);continue;}break;
   }
   if(!result||result.statusCode!==200||!/^image\/(?:jpeg|png|webp|gif|avif)(?:;|$)/i.test(result.headers['content-type']||'')){result?.destroy();throw new Error('unavailable');}
   const chunks=[];let size=0;for await(const chunk of result){size+=chunk.length;if(size>8*1024*1024){result.destroy();throw new Error('large');}chunks.push(chunk);}
   res.writeHead(200,{'Content-Type':result.headers['content-type'],'Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'});res.end(Buffer.concat(chunks));
  }catch{if(!res.headersSent){res.writeHead(502,{'Cache-Control':'no-store'});res.end();}else res.destroy();}finally{this.active--;}
 }
}
