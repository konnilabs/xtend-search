import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const {createDownstreamNoManualHtmlGate}=require('@ccslabs/xtend/rmt-language/app-platform-tooling');
const root=new URL('../../',import.meta.url).pathname;
test('pinned SDK components used by Search have no manual HTML sinks',()=>{
 const gate=createDownstreamNoManualHtmlGate({syntax:true,rootDir:root});
 const files=Object.fromEntries(['xicon','xbutton','xspinner','xtoggle','xsection','xtoast','xdialog','xalert'].map(name=>[name+'.js',fs.readFileSync(path.join(root,'node_modules/@ccslabs/xtend/components',name+'.js'),'utf8')]));
 assert.deepEqual(gate.scanFiles(files),[]);
});
test('SDK artifact and both Search build paths retain the audit contract',()=>{
 const provenance=JSON.parse(fs.readFileSync(path.join(root,'vendor-inputs/xtend-0.9.0-provenance.json')));
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'vendor-inputs',provenance.artifact))).digest('hex'),provenance.sha256);
 assert.equal(provenance.pullRequest,'https://github.com/konnilabs/xtend/pull/112');
 for(const file of ['scripts/build.cjs','scripts/build-control.cjs'])assert.match(fs.readFileSync(path.join(root,file),'utf8'),/htmlSecurity:\{sources\}/);
 assert.equal(fs.existsSync(path.join(root,'frontend/weather-units.mjs')),false);
});
