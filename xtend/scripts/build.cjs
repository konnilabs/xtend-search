require('../patches/ssr-resume/apply.cjs')();
const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const {buildMaracaBundleAsync}=require('@ccslabs/xtend/maraca');
const {buildPages}=require('@ccslabs/xtend/rmt-language/page-build');
const {createRmtCompilationSession}=require('@ccslabs/xtend/rmt-language/compilation-session');
const esbuild=require('esbuild');
const lightboxControls=require('../patches/xlightbox-controls.cjs');
async function build(){
 const root=path.resolve(__dirname,'..'),out=path.join(root,'public/assets/xtend');
 fs.rmSync(out,{recursive:true,force:true});
 fs.mkdirSync(out,{recursive:true});
 await esbuild.build({entryPoints:[path.join(root,'frontend/search-remote-adapter.mjs')],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',outfile:path.join(out,'search-remote-adapter.mjs')});
 const streamIntegrity=createHash('sha256').update(fs.readFileSync(path.join(out,'search-remote-adapter.mjs'))).digest('base64');
 const session=createRmtCompilationSession({root});
 try {
 const built=await buildMaracaBundleAsync({source:'frontend/search.rmt',out:'public/assets/xtend/maraca',profile:'production',lazy:'component',orchestration:'strict',kernel:'strict',kernelBootMode:'direct',hydration:'strict',validation:'auto',transitions:'auto',componentMode:'document',stackMode:'plan',css:'external'},{rootDir:root,compileSource:session.compileSource});
 if(!built.ok)throw Object.assign(new Error('Maraca-Build fehlgeschlagen'),{details:built.plan?.diagnostics || built});
 const report=JSON.parse(fs.readFileSync(path.join(out,'maraca/xtend.maraca.report.json')));
 if(!report.toolchain.rollup.available || !report.toolchain.terser.available)throw new Error('Production requires Rollup and Terser; local importgraph fallback is not deployable.');
 const configuration={applicationKey:'xtend.search',viewTransitions:false,events:built.plan.orchestration?.artifact?.events || []};
 const entry=`import publicKey from '/assets/xtend/resume-key.mjs';import {startMaracaPageApplication} from '@ccslabs/xtend/maraca/page-bootstrap';import {installSearchHost} from './frontend/host.mjs';installSearchHost();startMaracaPageApplication({...${JSON.stringify(configuration)},publicKey}).catch(()=>{});`;
 await esbuild.build({define:{__SEARCH_STREAM_INTEGRITY__:JSON.stringify(streamIntegrity)},plugins:[lightboxControls],stdin:{contents:entry,resolveDir:root,sourcefile:'page.mjs'},bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',splitting:true,external:['/assets/xtend/resume-key.mjs'],outExtension:{'.js':'.mjs'},entryNames:'page',chunkNames:'chunks/[name]-[hash]',outdir:out});
 await esbuild.build({entryPoints:[path.join(root,'frontend/search.css')],minify:true,bundle:true,outfile:path.join(out,'search.css')});
 for(const file of ['mark.svg','image-placeholder.svg'])fs.copyFileSync(path.join(root,'frontend',file),path.join(out,file));
 const pages=await buildPages({root,target:'node',compileSource:session.compileSource});
 fs.mkdirSync(path.join(root,'evidence/builds'),{recursive:true});
 const summary={ok:true,node:process.version,version:pages.manifest.version,sourceSha256:createHash('sha256').update(fs.readFileSync(path.join(root,'frontend/search.rmt'))).digest('hex'),compilation:session.snapshot()};
 fs.writeFileSync(path.join(root,'evidence/builds/build.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary));
 }finally{session.dispose();}
}
build().catch(error=>{console.error(error.message,JSON.stringify(error.details || error.diagnostics || {}));process.exitCode=1;});
