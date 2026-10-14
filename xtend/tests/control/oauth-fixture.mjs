import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {installWeatherFixture} from './weather-fixture.mjs';
const weather=installWeatherFixture({on(){}});
const codes=new Map();
const publicBase=new URL(process.env.TEST_BASE_URL||'http://localhost:8093');
if(publicBase.protocol!=='http:'||!['localhost','127.0.0.1'].includes(publicBase.hostname))throw Error('Fixture requires a loopback test origin');
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost:8094');res.setHeader('Cache-Control','no-store');
 if(await weather(req,res,url))return;
 if(url.pathname==='/apps/oauth2/authorize'){
  res.setHeader('Content-Type','text/html');res.end('<h1>Local Nextcloud OAuth2 protocol fixture</h1>'+['administrator','operator','viewer','outsider'].map(role=>`<a href="/grant?state=${encodeURIComponent(url.searchParams.get('state'))}&role=${role}">${role}</a>`).join('<br>'));return;
 }
 if(url.pathname==='/grant'){const code=randomUUID(),role=url.searchParams.get('role');codes.set(code,role);res.writeHead(302,{Location:publicBase.origin+'/admin/oauth/callback?'+new URLSearchParams({state:url.searchParams.get('state'),code})});res.end();return;}
 if(url.pathname==='/apps/oauth2/api/v1/token'){
  let text='';for await(const c of req)text+=c;const body=new URLSearchParams(text),role=codes.get(body.get('code'));codes.delete(body.get('code'));
  res.setHeader('Content-Type','application/json');if(!role||body.get('client_secret')!=='fixture-only'){res.writeHead(400);res.end('{}');return;}
  res.end(JSON.stringify({access_token:role,token_type:'Bearer',user_id:role,refresh_token:'not-retained',expires_in:3600}));return;
 }
 if(url.pathname==='/ocs/v2.php/cloud/user'){const id=req.headers.authorization?.slice(7);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ocs:{meta:{status:'ok'},data:{id}}}));return;}
 res.writeHead(404);res.end();
}).listen(Number(process.env.FIXTURE_PORT||8094),process.env.FIXTURE_BIND||'127.0.0.1',()=>console.log('OAuth2 fixture ready.'));
