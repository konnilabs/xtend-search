require('../patches/ssr-resume/apply.cjs')();
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {buildMaracaBundleAsync}=require('@ccslabs/xtend/maraca');
const {buildPages}=require('@ccslabs/xtend/rmt-language/page-build');
const {createRmtCompilationSession}=require('@ccslabs/xtend/rmt-language/compilation-session');
const esbuild=require('esbuild'),lightboxControls=require('../patches/xlightbox-controls.cjs');
async function main(){
 const root=path.resolve(__dirname,'..'),out=path.join(root,'public/assets/xtend');fs.mkdirSync(out,{recursive:true});
 const session=createRmtCompilationSession({root});const summaries=[];
 try{for(const admin of [false,true]){
  const folder=admin?'admin':'standalone',source=admin?'admin/admin.rmt':'frontend/standalone.rmt',entry=admin?'admin/services.ts':'frontend/services.ts';
  const options={source,out:`public/assets/xtend/${folder}/maraca`,profile:'production',sizeBudget:'warn',lazy:'component',orchestration:'strict',kernel:'strict',kernelBootMode:'direct',hydration:'strict',validation:'auto',transitions:'auto',componentMode:'document',stackMode:'plan',css:'external',services:{clientEntry:entry,serverEntry:'server/control/server-services.ts',targets:['browser','node'],strict:true,budgets:{clientBytes:20000,serverBytes:300000},transport:{kind:'http-ndjson',basePath:'/api/xtend/services'}}};
  const built=await buildMaracaBundleAsync(options,{rootDir:root,compileSource:session.compileSource});
  if(!built.ok)fs.writeFileSync(path.join(root,'../../../work/control-plane/build-failure.json'),JSON.stringify(built));
  if(!built.ok)throw Object.assign(new Error('Maraca control build failed: '+folder),{details:built.plan?.diagnostics||built});
  const configuration={applicationKey:admin?'xtend.search.admin':'xtend.search',viewTransitions:false,events:built.plan.orchestration?.artifact?.events||[]};
  const bootstrap=admin?
   `import {watchObservatory} from './admin/live.mjs';const csrf=document.querySelector('meta[name="csrf-token"]').content;startMaracaPageApplication({...${JSON.stringify(configuration)},publicKey}).then(client=>watchObservatory(client,csrf)).catch(error=>console.error("observatory-boot",error.message));`:
   `import {installSearchHost} from './frontend/standalone-host.mjs';installSearchHost();startMaracaPageApplication({...${JSON.stringify(configuration)},publicKey}).catch(()=>{});`;
  await esbuild.build({plugins:[lightboxControls],stdin:{contents:`import publicKey from '/assets/xtend/resume-key.mjs';import {startMaracaPageApplication} from '@ccslabs/xtend/maraca/page-bootstrap';${bootstrap}`,resolveDir:root,sourcefile:'page.mjs'},bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',splitting:true,external:['/assets/xtend/resume-key.mjs'],outExtension:{'.js':'.mjs'},entryNames:'page',chunkNames:'chunks/[name]-[hash]',outdir:path.join(out,folder)});
  await esbuild.build({entryPoints:[path.join(root,admin?'admin/admin.css':'frontend/standalone.css')],bundle:true,minify:true,outfile:path.join(out,folder,admin?'admin.css':'search.css')});
  const pages=await buildPages({root,target:'node',config:admin?'admin/pages.json':'standalone.pages.json',compileSource:session.compileSource});
  fs.copyFileSync(path.join(root,'.xtend-build/pages.json'),path.join(root,'.xtend-build',admin?'pages-admin.json':'pages-standalone.json'));
  fs.copyFileSync(path.join(root,'server/control/storage-worker.mjs'),path.join(out,folder,'maraca/server/storage-worker.mjs'));
  summaries.push({folder,version:pages.manifest.version,sourceSha256:createHash('sha256').update(fs.readFileSync(path.join(root,source))).digest('hex'),services:built.plan.services?.status});
 }
 for(const file of ['mark.svg','image-placeholder.svg','favicon.png'])fs.copyFileSync(path.join(root,'frontend',file),path.join(out,file));
 await esbuild.build({entryPoints:[path.join(root,'frontend/admin-login.mjs')],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'standalone/admin-login.mjs')});
 fs.mkdirSync(path.join(root,'evidence/control-plane'),{recursive:true});fs.writeFileSync(path.join(root,'evidence/control-plane/build.json'),JSON.stringify({ok:true,node:process.version,summaries},null,2));console.log(JSON.stringify({ok:true,summaries}));
 }finally{session.dispose();}
}
main().catch(e=>{console.error(e.message,JSON.stringify(e.details||e.diagnostics||{},null,2));process.exitCode=1;});
