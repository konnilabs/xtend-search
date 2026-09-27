import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repository=path.dirname(root);
const directory=process.env.XTEND_SECRET_DIR || path.join(root,'.secrets');
fs.mkdirSync(directory,{recursive:true,mode:0o700});
const generated=spawnSync(process.execPath,[path.join(root,'scripts/keys.mjs')],{stdio:'inherit',env:{...process.env,XTEND_SECRET_DIR:directory}});
if(generated.status!==0)process.exit(1);
const coreSecret=path.join(directory,'core-secret');
if(!fs.existsSync(coreSecret))fs.writeFileSync(coreSecret,randomBytes(48).toString('hex'),{mode:0o600});
const fixture=process.env.XTEND_TEST_FIXTURE==='1';
const env={...process.env,XTEND_SECRET_DIR:directory,SEARXNG_SECRET:fs.readFileSync(coreSecret,'utf8').trim(),PYTHONPATH:repository};
if(fixture)env.SEARXNG_SETTINGS_PATH=path.join(root,'config/settings.fixture.yml');
else env.SEARXNG_SETTINGS_PATH ||= path.join(root,'config/settings.yml');
const specs=[
 ['core',process.env.XTEND_PYTHON || 'python3',['-m','granian','--interface','wsgi','--host','127.0.0.1','--port',process.env.XTEND_CORE_PORT || '8082','--blocking-threads','4','--backpressure','32','xtend.server.core:application']],
 ['page',process.execPath,[path.join(root,'server/host.mjs')]],
 ['gateway',process.execPath,[path.join(root,'server/gateway.mjs')]]
];
let stopping=false;const children=new Set(),attempts=new Map();
function start(spec){
 const [name,command,args]=spec;
 const child=spawn(command,args,{cwd:repository,env,stdio:'inherit'});children.add(child);
 child.on('error',error=>{console.error(`${name} start failed: ${error.code}`);shutdown(1);});
 child.on('exit',()=>{
  children.delete(child);if(stopping)return;
  const count=(attempts.get(name)||0)+1;attempts.set(name,count);
  if(count>5){console.error(`${name} restart budget exhausted.`);shutdown(1);return;}
  console.error(`${name} exited; restarting in ${count} second(s).`);setTimeout(()=>{if(!stopping)start(spec);},count*1000);
 });
}
function shutdown(code=0){
 if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');
 const interval=setInterval(()=>{if(!children.size){clearInterval(interval);process.exit(code);}},100);
 setTimeout(()=>{for(const child of children)child.kill('SIGKILL');process.exit(code);},10000).unref();
}
process.on('SIGTERM',()=>shutdown());process.on('SIGINT',()=>shutdown());
for(const spec of specs)start(spec);
