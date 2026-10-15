import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {baseData,normalizeResults} from '../../server/search.mjs';
import {projectPortableRender} from '@ccslabs/xtend/rmt/portable-render';
import {createRmtNodeSsrAdapter} from '@ccslabs/xtend/rmt/node-ssr-adapter';
import {ssrCapabilities} from '../../server/ssr-capabilities.mjs';
const artifact=JSON.parse(fs.readFileSync(new URL('../../.xtend-build/pages-standalone.json',import.meta.url))).pages.Search.artifact;
const state={q:'fixture',category:'general',language:'all',timeRange:'',safeSearch:'1',page:1};
const raw={results:[],infoboxes:[],xtend:{schema:'searxng-xtend.core.v1'}};
async function html(data){
 const projected=projectPortableRender(artifact,{'search.query':state.q,'search.data':data,'search.filters':{language:'all',timeRange:'',safeSearch:'1'}});
 const rendered=await createRmtNodeSsrAdapter(ssrCapabilities).render({descriptor:projected.descriptor},{model:projected.model,nativeForms:true});
 assert.equal(rendered.ok,true);assert.equal(/\$model\.search\.data\.(emptyTitle|emptyMessage|errorMessage)/.test(rendered.html),false,'Empty-state text must resolve instead of displaying a model path');return rendered.html;
}
test('normal search data declares optional empty-state copy instead of leaving binding holes',()=>{
 for(const data of [baseData(state),normalizeResults(raw,state)]){assert.equal(data.emptyTitle,'');assert.equal(data.emptyMessage,'');}
});
test('provider failure renders readable fallback when optional copy is absent, null or empty',async()=>{
 for(const copy of [{},{emptyTitle:null,emptyMessage:null},{emptyTitle:'',emptyMessage:''}]){
  const data={...baseData(state),error:true,empty:false,errorMessage:'Die Quellen sind vorübergehend nicht erreichbar.',...copy};
  if(!Object.hasOwn(copy,'emptyTitle')){delete data.emptyTitle;delete data.emptyMessage;}
  const output=await html(data);assert.match(output,/Die Suche ist gerade nicht erreichbar\./);assert.match(output,/Die Quellen sind vorübergehend nicht erreichbar\./);
 }
});
test('empty search, weather-specific copy and missing error detail keep their intended messages',async()=>{
 assert.match(await html({...normalizeResults(raw,state)}),/Noch nichts gefunden\./);
 assert.match(await html({...normalizeResults(raw,state),emptyTitle:'Kein passender Ort gefunden',emptyMessage:'Bitte einen Ortsnamen eingeben.'}),/Kein passender Ort gefunden/);
 assert.match(await html({...baseData(state),error:true,errorMessage:undefined}),/Bitte versuche es später erneut\./);
});
