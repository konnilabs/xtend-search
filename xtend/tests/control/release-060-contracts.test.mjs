import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRmtCompilationSession} from '@ccslabs/xtend/rmt-language/compilation-session';
import {createRmtNodeSsrAdapter,getRmtSsrCoverage} from '@ccslabs/xtend/rmt/node-ssr-adapter';
import {projectPortableRender} from '@ccslabs/xtend/rmt/portable-render';
import {ssrCapabilities} from '../../server/ssr-capabilities.mjs';
test('strict source compiles filter surfaces into interruptible reduced-motion AnimationEngine transitions',()=>{
 const session=createRmtCompilationSession({root:new URL('../../',import.meta.url).pathname});
 try{const result=session.compileSource({text:fs.readFileSync(new URL('../../frontend/standalone.rmt',import.meta.url),'utf8'),filePath:'frontend/standalone.rmt'});
 assert.equal(result.ok,true);const transitions=result.orchestrationArtifacts.animationEngine.transitions;
 assert.deepEqual(transitions.map(t=>[t.id,t.effect,t.durationMs,t.interrupt,t.reducedMotion]),[['search.filters.open','slide-down',180,'replace','instant'],['search.filters.close','fade',140,'replace','instant']]);
 }finally{session.dispose();}
});
test('report assistant and discard dialog are SSR/resume capable while a draft is open',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../.xtend-build/pages-standalone.json',import.meta.url))),artifact=structuredClone(manifest.pages.Search.artifact);
 const props={'search.query':'','search.data':{view:'home',tabs:[],results:[],knowledgeCards:[],warnings:[],pages:[]},'search.feedback':{open:true,confirm:true,selected:[],reason:'spam',includeUrl:false,busy:false},'search.filters':{language:'all',timeRange:'',safeSearch:'1'}};
 artifact.defaults['search.feedback']=props['search.feedback'];
 const projected=projectPortableRender(artifact,props),adapter=createRmtNodeSsrAdapter(ssrCapabilities);
 const rendered=await adapter.render({descriptor:projected.descriptor},{model:projected.model,nativeForms:true,executionMode:'server_prerender_resume',resume:{state:projected.model,sign:()=>({keyId:'fixture',signature:'fixture'})}});
 assert.equal(rendered.ok,true);assert.match(rendered.html,/<x-search-report-assistant/);assert.match(rendered.html,/Meldung verwerfen\?/);assert.equal(getRmtSsrCoverage(rendered).missingCapabilityNodes,0);
});
test('weather units use the native XToggle contract with complete SSR/resume coverage',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../.xtend-build/pages-standalone.json',import.meta.url))),artifact=structuredClone(manifest.pages.Search.artifact);
 const props={'search.query':'Fixture','search.data':{view:'results',isSearch:true,category:'weather',tabs:[],results:[],knowledgeCards:[],warnings:[],pages:[],weather:{hasPlace:false,places:[]}},'search.filters':{language:'all',timeRange:'',safeSearch:'1'}};
 const projected=projectPortableRender(artifact,props),adapter=createRmtNodeSsrAdapter(ssrCapabilities);
 const rendered=await adapter.render({descriptor:projected.descriptor},{model:projected.model,nativeForms:true,executionMode:'server_prerender_resume',resume:{state:projected.model,sign:()=>({keyId:'fixture',signature:'fixture'})}});
 assert.equal(rendered.ok,true);assert.match(rendered.html,/<x-toggle[^>]*id="weather-unit-toggle"/);assert.doesNotMatch(rendered.html,/id="report-start"/);assert.equal(getRmtSsrCoverage(rendered).missingCapabilityNodes,0);
});
