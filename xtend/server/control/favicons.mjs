import {createHmac,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
export class FaviconService {
 constructor(adapter,key,{resolver=process.env.XTEND_FAVICON_RESOLVER||'duckduckgo',fetchImpl=fetch,now=Date.now}={}){if(!['off','duckduckgo'].includes(resolver))throw new Error('Unsupported favicon resolver');this.adapter=adapter;this.key=key;this.enabled=resolver!=='off';this.fetch=fetchImpl;this.now=now;this.active=0;this.requests=new Map();this.misses=new Map();this.rate={until:0,count:0};}
 sign(value){if(!this.enabled||!this.adapter.faviconContract)return '';let domain;try{domain=new URL(value).hostname.toLowerCase();}catch{return '';}if(isIP(domain)||!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(domain))return '';const exp=Math.floor(this.now()/86400000)+1,body=domain+'.'+exp,mac=createHmac('sha256',this.key).update('favicon:'+body).digest('base64url');return '/favicon?'+new URLSearchParams({domain,exp:String(exp),mac});}
 async handle(req,res,url){const {domain,exp,mac}=Object.fromEntries(url.searchParams),wanted=this.sign('https://'+domain);
  if(!wanted||!mac||!/^[-_A-Za-z0-9]{43}$/.test(mac)||!Number.isInteger(Number(exp))||Number(exp)<this.now()/86400000||Number(exp)>Math.floor(this.now()/86400000)+1){res.writeHead(403);res.end();return;}
  const expected=createHmac('sha256',this.key).update('favicon:'+domain+'.'+exp).digest('base64url');if(!timingSafeEqual(Buffer.from(mac),Buffer.from(expected))){res.writeHead(403);res.end();return;}
  for(const [id,until]of this.misses)if(until<=this.now())this.misses.delete(id);
  const headers={'Content-Type':'image/png','Cache-Control':'private, max-age=86400','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff'};
  if((this.misses.get(domain)||0)>this.now()){res.writeHead(204,{'Cache-Control':'private, max-age=3600'});res.end();return;}
  if(this.rate.until<this.now())this.rate={until:this.now()+60000,count:0};
  if(!this.requests.has(domain)&&(this.active>=2||this.rate.count>=120)){res.writeHead(429,{'Retry-After':'60'});res.end();return;}
  if(!this.requests.has(domain)){
   this.active++;this.rate.count++;const operation=(async()=>{const target=new URL('xtend/favicon',this.adapter.base);target.searchParams.set('domain',domain);try{const response=await this.fetch(target,{headers:{Authorization:'Bearer '+this.adapter.token,Accept:'image/png'},redirect:'error',signal:AbortSignal.timeout(2000)});if(!response.ok||response.status===204||!response.headers.get('content-type')?.startsWith('image/png')){await response.body?.cancel();return null;}const reader=response.body.getReader(),parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new Error('size');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}const bytes=Buffer.concat(parts);return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?bytes:null;}catch{return null;}})().finally(()=>{this.active--;this.requests.delete(domain);});this.requests.set(domain,operation);
  }
  const bytes=await this.requests.get(domain);if(res.destroyed)return;if(bytes){res.writeHead(200,headers);res.end(bytes);}else{if(this.misses.size<10000)this.misses.set(domain,this.now()+3600000);res.writeHead(204,{'Cache-Control':'private, max-age=3600'});res.end();}
 }
}
