// Paired release package; run as a Docker-authorized user after all gates.
import fs from 'node:fs';import path from 'node:path';import {execFileSync,spawn} from 'node:child_process';import {createHash} from 'node:crypto';import {createGzip} from 'node:zlib';import {pipeline} from 'node:stream/promises';
import {VERSION,BACKEND_VERSION} from '../server/control/release.mjs';
const root=path.resolve(import.meta.dirname,'../..'),output=path.resolve(process.argv[2]||path.join(root,'../../outputs'));
const directory=path.join(output,`XTend-search-Docker-${VERSION}-linux-amd64`);fs.mkdirSync(directory,{recursive:true});
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
execFileSync(process.execPath,[path.join(root,'xtend/scripts/export-control-image.mjs'),directory],{stdio:'inherit'});
const frontend=`xtend-search:${VERSION}`,backend=`xtend-search-searxng:${BACKEND_VERSION}`;
const [info]=JSON.parse(execFileSync('docker',['image','inspect',backend],{encoding:'utf8'}));
if(info.Os!=='linux'||info.Architecture!=='amd64'||info.Config.Labels['org.opencontainers.image.version']!==BACKEND_VERSION)throw Error('Backend identity mismatch');
const pin=JSON.parse(fs.readFileSync(path.join(root,'xtend/upstream-searxng.json')));
for(const [name,expected]of Object.entries(pin.reviewedIntegratedFiles)){
 const actual=execFileSync('docker',['run','--rm','--entrypoint','python',info.Id,'-c',`import hashlib; print(hashlib.sha256(open('/app/${name}', 'rb').read()).hexdigest())`],{encoding:'utf8'}).trim();if(actual!==expected)throw Error('Unreviewed backend file: '+name);
}
const archive=`XTend-search-SearXNG-Image-${BACKEND_VERSION}-linux-amd64.tar.gz`,target=path.join(directory,archive);if(fs.existsSync(target))throw Error('Versioned archive already exists');
const saving=spawn('docker',['save',backend],{stdio:['ignore','pipe','inherit']}),complete=new Promise((resolve,reject)=>{saving.on('error',reject);saving.on('close',code=>code===0?resolve():reject(Error('docker save failed')));});
await Promise.all([complete,pipeline(saving.stdout,createGzip({level:6}),fs.createWriteStream(target,{flags:'wx'}))]);
for(const file of ['compose.portainer.yml','compose.control.yml','LICENSE'])fs.copyFileSync(path.join(root,file),path.join(directory,file));
for(const [source,name]of [['xtend/config/portainer.env.example','portainer.env.example'],['xtend/docs/RELEASE-0.5.0.md','UPGRADE.md'],['xtend/vendor-inputs/xtend-0.9.0-provenance.json','SDK-PROVENANCE.json']])fs.copyFileSync(path.join(root,source),path.join(directory,name));
const container=execFileSync('docker',['create',frontend],{encoding:'utf8'}).trim();try{execFileSync('docker',['cp',container+':/app/source.tar.gz',path.join(directory,`xtend-search-${VERSION}-source.tar.gz`)]);}finally{execFileSync('docker',['rm',container],{stdio:'ignore'});}
const evidence=fs.readdirSync(path.join(root,'xtend/evidence/control-plane')).filter(n=>(n.startsWith(VERSION+'-')||n.startsWith('release-'+VERSION+'-'))&&n.endsWith('.json')).map(n=>'xtend/evidence/control-plane/'+n);
execFileSync('tar',['-czf',path.join(directory,`xtend-search-${VERSION}-verification.tar.gz`),...evidence],{cwd:root});
fs.writeFileSync(path.join(directory,'IMAGE-IDS.txt'),execFileSync('docker',['image','inspect',frontend,backend,'--format','{{index .RepoTags 0}} {{.Id}} {{.Os}}/{{.Architecture}}'],{encoding:'utf8'}));
fs.writeFileSync(path.join(directory,'load.sh'),`#!/bin/sh\nset -eu\ncd "$(dirname "$0")"\nsha256sum -c SHA256SUMS\ndocker load -i XTend-search-Docker-Image-${VERSION}-linux-amd64.tar.gz\ndocker load -i ${archive}\n`,{mode:0o755});
const rawEvidence=path.join(root,'xtend/evidence/control-plane/framework-raw');if(fs.existsSync(rawEvidence))execFileSync('tar',['-czf',path.join(directory,`xtend-search-${VERSION}-framework-validation.tar.gz`),'-C',rawEvidence,'.']);
const files=fs.readdirSync(directory).filter(n=>n!=='SHA256SUMS');fs.writeFileSync(path.join(directory,'SHA256SUMS'),files.map(n=>`${hash(path.join(directory,n))}  ${n}\n`).join(''));
const bundle=directory+'.tar.gz';if(fs.existsSync(bundle))throw Error('Release bundle already exists');execFileSync('tar',['-czf',bundle,'-C',output,path.basename(directory)]);fs.writeFileSync(bundle+'.sha256',`${hash(bundle)}  ${path.basename(bundle)}\n`);console.log(JSON.stringify({ok:true,bundle,frontend,backend}));
