// Export a validated, explicitly versioned frontend image as a directly loadable
// archive. Refuse stale tags or sources: those caused the original 0.3.0 incident.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';
import {createGzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {VERSION} from '../server/control/release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]||path.join(root,'../..'));
const ref=`xtend-search:${VERSION}`;
const [info]=JSON.parse(execFileSync('docker',['image','inspect',ref],{encoding:'utf8'}));
if(info.Architecture!=='amd64'||info.Os!=='linux'||info.Config.Labels?.['org.opencontainers.image.version']!==VERSION)throw new Error('Image platform or release label mismatch');
const sources=[];
for(const directory of ['frontend','admin','server','shared','patches','vendor-inputs'])for(const file of fs.readdirSync(path.join(root,directory),{recursive:true})){
 const name=directory+'/'+file;if(fs.statSync(path.join(root,name)).isFile()&&!name.includes('__pycache__')&&!name.endsWith('.pyc'))sources.push(name);
}
sources.push('package.json','package-lock.json','standalone.pages.json','upstream-searxng.json','scripts/build-control.cjs');
const verify=`const fs=require('fs'),crypto=require('crypto');const root='/app/xtend/';const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(root+p)).digest('hex');console.log(JSON.stringify({version:JSON.parse(fs.readFileSync(root+'package.json')).version,files:Object.fromEntries(${JSON.stringify(sources)}.map(p=>[p,hash(p)])),bundles:Object.fromEntries(['admin/admin.css','standalone/search.css','standalone/page.mjs','standalone/admin-login.mjs'].map(p=>[p,hash('public/assets/xtend/'+p)]))}));`;
const built=JSON.parse(execFileSync('docker',['run','--rm','--entrypoint','node',info.Id,'-e',verify],{encoding:'utf8'}));
const hashFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sdkProvenance=JSON.parse(fs.readFileSync(path.join(root,'vendor-inputs/xtend-0.9.0-provenance.json')));
if(hashFile(path.join(root,'vendor-inputs',sdkProvenance.artifact))!==sdkProvenance.sha256)throw new Error('SDK provenance mismatch');
if(built.version!==VERSION)throw new Error('Packaged version mismatch');
for(const file of sources)if(built.files[file]!==hashFile(path.join(root,file)))throw new Error('Image is older than release source: '+file);
fs.mkdirSync(output,{recursive:true});
const name=`XTend-search-Docker-Image-${VERSION}-linux-amd64.tar.gz`,target=path.join(output,name);
if(fs.existsSync(target))throw new Error('Release archive already exists; do not silently replace a versioned release');
const temporary=target+'.partial';
const saving=spawn('docker',['image','save',ref],{stdio:['ignore','pipe','pipe']});let stderr='';saving.stderr.on('data',v=>stderr+=v);
const done=new Promise((resolve,reject)=>{saving.on('error',reject);saving.on('close',code=>code===0?resolve():reject(new Error('docker save failed: '+stderr)));});
try{
 await Promise.all([done,pipeline(saving.stdout,createGzip({level:6}),fs.createWriteStream(temporary,{flags:'wx'}))]);
 const checksum=createHash('sha256');for await(const chunk of fs.createReadStream(temporary))checksum.update(chunk);
 fs.renameSync(temporary,target);
 fs.writeFileSync(target+'.sha256',`${checksum.digest('hex')}  ${name}\n`);
 const report={version:VERSION,tag:ref,id:info.Id,platform:'linux/amd64',sourceHashes:built,archive:name,bytes:fs.statSync(target).size};
 fs.writeFileSync(path.join(output,`XTend-search-${VERSION}-IMAGE-ID.txt`),`${ref}\n${info.Id}\nlinux/amd64\n`);
 fs.writeFileSync(path.join(root,'evidence/control-plane',`release-${VERSION}-export.json`),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}catch(error){saving.kill();fs.rmSync(temporary,{force:true});throw error;}
