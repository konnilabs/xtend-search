import fs from 'node:fs';import path from 'node:path';import {execFileSync,spawn} from 'node:child_process';import {pipeline} from 'node:stream/promises';import {createGzip} from 'node:zlib';import {createHash} from 'node:crypto';import {VERSION} from '../server/control/release.mjs';
const output=path.resolve(process.argv[2]||'..'),ref='xtend-search-searxng:'+VERSION;
const [info]=JSON.parse(execFileSync('docker',['image','inspect',ref],{encoding:'utf8'}));
if(info.Architecture!=='amd64'||info.Os!=='linux'||info.Config.Labels['org.opencontainers.image.version']!==VERSION)throw Error('Backend version or platform mismatch');
const root=path.resolve(import.meta.dirname,'../..'),files=['xtend/server/backend.py','xtend/server/backend-start.py','xtend/server/favicon_backend.py','xtend/requirements.lock.txt','xtend/config/settings.control.yml'];
const script='import json,hashlib;from pathlib import Path;print(json.dumps({p:hashlib.sha256(Path("/app",p).read_bytes()).hexdigest() for p in '+JSON.stringify(files)+'}))';
const hashes=JSON.parse(execFileSync('docker',['run','--rm','--entrypoint','python',ref,'-c',script],{encoding:'utf8'}));
for(const f of files)if(hashes[f]!==createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex'))throw Error('Stale backend: '+f);
const name='XTend-search-SearXNG-Image-'+VERSION+'-linux-amd64.tar.gz',target=path.join(output,name);fs.mkdirSync(output,{recursive:true});if(fs.existsSync(target))throw Error('Release already exported');
const saving=spawn('docker',['save',ref],{stdio:['ignore','pipe','pipe']});let error='';saving.stderr.on('data',v=>error+=v);
const ended=new Promise((resolve,reject)=>{saving.on('error',reject);saving.on('close',code=>code?reject(Error(error)):resolve());});
try{await Promise.all([ended,pipeline(saving.stdout,createGzip({level:6}),fs.createWriteStream(target+'.partial',{flags:'wx'}))]);fs.renameSync(target+'.partial',target);}catch(e){saving.kill();fs.rmSync(target+'.partial',{force:true});throw e;}
const hash=createHash('sha256');for await(const c of fs.createReadStream(target))hash.update(c);
fs.writeFileSync(target+'.sha256',hash.digest('hex')+'  '+name+'\n');fs.writeFileSync(path.join(output,'XTend-search-'+VERSION+'-BACKEND-IMAGE-ID.txt'),ref+'\n'+info.Id+'\nlinux/amd64\n');
const report={version:VERSION,tag:ref,id:info.Id,hashes,archive:name,bytes:fs.statSync(target).size};fs.writeFileSync(path.join(root,'xtend/evidence/control-plane/release-'+VERSION+'-backend-export.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
