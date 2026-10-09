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
const sources=['frontend/search-motion.mjs','frontend/standalone-streaming.mjs','frontend/search.css','frontend/filter-navigation.mjs','frontend/admin-login.mjs','server/control/login-page.mjs','upstream-searxng.json','server/ssr-capabilities.mjs','patches/ssr-resume/apply.cjs','patches/ssr-resume/manifest.json','frontend/preview.mjs','server/control/quality.mjs','server/control/evidence.mjs','server/control/favicons.mjs','server/control/dashboard.mjs','server/control/composition.mjs','server/control/storage-worker.mjs','server/control/feedback-http.mjs','server/control/server-services.ts','frontend/services.ts','admin/services.ts','admin/live.mjs','frontend/feedback.mjs','frontend/favicons.mjs','shared/feedback.mjs','shared/feedback-form.mjs','server/control/source-messages.mjs','server/control/executor.mjs','server/control/adapter.mjs','server/control/locales.mjs','scripts/repair-locale-catalog.mjs','shared/about.mjs','server/about.mjs','frontend/about.mjs','frontend/about-dialog.mjs','frontend/about.css','frontend/favicon.png','frontend/mark.svg','scripts/build-control.cjs','admin/admin.css','admin/admin.rmt','frontend/standalone.rmt','frontend/standalone.css','frontend/standalone-host.mjs','frontend/preferences.mjs','server/preferences.mjs','server/standalone.mjs','server/control/plane.mjs','server/control/executor.mjs','server/control/admin.mjs','server/control/release.mjs','standalone.pages.json'];
const verify=`const fs=require('fs'),crypto=require('crypto');const root='/app/xtend/';const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(root+p)).digest('hex');console.log(JSON.stringify({version:JSON.parse(fs.readFileSync(root+'package.json')).version,files:Object.fromEntries(${JSON.stringify(sources)}.map(p=>[p,hash(p)])),bundles:Object.fromEntries(['admin/admin.css','standalone/search.css','standalone/page.mjs','standalone/admin-login.mjs'].map(p=>[p,hash('public/assets/xtend/'+p)]))}));`;
const built=JSON.parse(execFileSync('docker',['run','--rm','--entrypoint','node',info.Id,'-e',verify],{encoding:'utf8'}));
const hashFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const overlay=JSON.parse(fs.readFileSync(path.join(root,'patches/ssr-resume/manifest.json')));
for(const file of overlay.files){
 const expected=hashFile(path.join(root,'patches/ssr-resume/files',file.path));
 if(expected!==file.after)throw new Error('Patch replacement hash mismatch: '+file.path);
 const imageHash=execFileSync('docker',['run','--rm','--entrypoint','node',info.Id,'-e',`console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('/app/xtend/node_modules/@ccslabs/xtend/'+${JSON.stringify(file.path)})).digest('hex'))`],{encoding:'utf8'}).trim();
 if(imageHash!==file.after)throw new Error('Image lacks framework patch: '+file.path);
}
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
