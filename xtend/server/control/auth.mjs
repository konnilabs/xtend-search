import {randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import fs from 'node:fs';
import {jsonResponse} from './adapter.mjs';
import {fail} from './contracts.mjs';
export const secret=(name,env=process.env)=>env[name+'_FILE']?fs.readFileSync(env[name+'_FILE'],'utf8').trim():env[name]||'';
const token=()=>randomBytes(32).toString('base64url');
const hash=s=>createHash('sha256').update(String(s)).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const cookie=(req,name)=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
export class NextcloudAuth {
 constructor({env=process.env,fetchImpl=fetch}={}){
  this.fetch=fetchImpl;this.origin=new URL(env.PUBLIC_BASE_URL||'http://localhost:8080').origin;this.secure=this.origin.startsWith('https:');this.base=new URL(env.NEXTCLOUD_BASE_URL||'https://vm.ccs-networks.de/cloud/');
  if(this.base.protocol!=='https:'&&!(env.XTEND_TEST_FIXTURE==='1'&&['localhost','127.0.0.1','auth-fixture'].includes(this.base.hostname)))throw new Error('Nextcloud requires HTTPS');
  if(!this.secure&&!['localhost','127.0.0.1','[::1]'].includes(new URL(this.origin).hostname))throw new Error('Public admin origin requires HTTPS');
  this.base.pathname=this.base.pathname.replace(/\/?$/,'/');
  this.prefix=env.NEXTCLOUD_INDEX_PHP==='1'?'index.php/':'';this.clientId=env.NEXTCLOUD_CLIENT_ID||'';this.clientSecret=secret('NEXTCLOUD_CLIENT_SECRET',env);
  this.roles=JSON.parse(env.XTEND_ADMIN_ROLES||'{}');if(!this.roles||Array.isArray(this.roles)||Object.values(this.roles).some(r=>!['viewer','operator','administrator'].includes(r)))throw new Error('Invalid admin role mapping');
  this.pending=new Map();this.sessions=new Map();this.name=this.secure?'__Host-xtend-admin':'xtend-admin';this.flowName=this.secure?'__Host-xtend-flow':'xtend-flow';
 }
 get configured(){return Boolean(this.clientId&&this.clientSecret&&Object.keys(this.roles).length);}
 setCookie(res,name,value,age){res.setHeader('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${this.secure?'; Secure':''}`);}
 cleanup(){const t=Date.now();for(const [k,v]of this.pending)if(v.expires<t)this.pending.delete(k);for(const [k,v]of this.sessions)if(v.expires<t)this.sessions.delete(k);}
 session(req){this.cleanup();const s=this.sessions.get(hash(cookie(req,this.name)));return s&&s.expires>Date.now()?s:null;}
 context(req){const s=this.session(req);if(!s)fail('unauthenticated','Bitte erneut über Nextcloud anmelden.');return {actor:s.actor,role:this.roles[s.actor],csrf:s.csrf};}
 protect(req){const c=this.context(req);if(req.headers.origin!==this.origin||!equal(req.headers['x-csrf-token'],c.csrf))fail('csrf','Die Sicherheitsprüfung ist fehlgeschlagen. Bitte die Admin-Seite neu öffnen.');return c;}
 begin(req,res){this.cleanup();if(!this.configured)fail('auth_setup','Nextcloud-Anmeldung ist noch nicht konfiguriert.');if(this.pending.size>=100)fail('busy','Zu viele Anmeldeversuche. Bitte später erneut versuchen.');const state=token(),binding=token();this.pending.set(hash(state),{binding:hash(binding),expires:Date.now()+300000});this.setCookie(res,this.flowName,binding,300);const url=new URL(this.prefix+'apps/oauth2/authorize',this.base);url.search=new URLSearchParams({client_id:this.clientId,response_type:'code',state,redirect_uri:this.origin+'/admin/oauth/callback'});res.writeHead(302,{Location:url.href});res.end();}
 async callback(req,res,url){
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||!code||code.length>2048)fail('auth_invalid','Anmeldung ungültig oder abgebrochen.');const flow=this.pending.get(hash(state));this.pending.delete(hash(state));
  if(!flow||flow.expires<Date.now()||!equal(flow.binding,hash(cookie(req,this.flowName))))fail('auth_invalid','Anmeldung abgelaufen oder nicht diesem Browser zugeordnet.');
  const response=await this.fetch(new URL(this.prefix+'apps/oauth2/api/v1/token',this.base),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:this.clientId,client_secret:this.clientSecret,redirect_uri:this.origin+'/admin/oauth/callback'}),redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)fail('auth_failed','Nextcloud konnte die Anmeldung nicht bestätigen.');const credentials=await jsonResponse(response,32768);
  if(typeof credentials.access_token!=='string'||credentials.token_type?.toLowerCase()!=='bearer'||typeof credentials.user_id!=='string')fail('auth_failed');
  const profileResponse=await this.fetch(new URL('ocs/v2.php/cloud/user?format=json',this.base),{headers:{Authorization:`Bearer ${credentials.access_token}`,'OCS-APIRequest':'true',Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!profileResponse.ok)fail('auth_failed');const profile=await jsonResponse(profileResponse,65536);const actor=profile.ocs?.data?.id;
  if(profile.ocs?.meta?.status!=='ok'||actor!==credentials.user_id||!Object.hasOwn(this.roles,actor))fail('forbidden','Dieses Nextcloud-Konto ist für das Observatory nicht freigegeben.');
  // No OIDC ID token, scopes, PKCE or MFA assertion is invented. Nextcloud's
  // confidential-client OAuth2 + authenticated OCS identity is the contract.
  // Access/refresh tokens end with this stack frame; sessions contain no tokens.
  this.cleanup();if(this.sessions.size>=100)fail('busy');const id=token();this.sessions.set(hash(id),{actor,role:this.roles[actor],csrf:token(),expires:Date.now()+1800000});this.setCookie(res,this.name,id,1800);res.writeHead(303,{Location:'/admin'});res.end();
 }
 logout(req,res){this.protect(req);this.sessions.delete(hash(cookie(req,this.name)));this.setCookie(res,this.name,'',0);res.writeHead(303,{Location:'/admin'});res.end();}
}
