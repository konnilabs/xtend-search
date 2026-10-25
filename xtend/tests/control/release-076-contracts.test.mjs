import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRmtCompilationSession} from '@ccslabs/xtend/rmt-language/compilation-session';
test('sidebar lifecycle is compiled into isolated replaceable reduced-motion surfaces',()=>{
 const session=createRmtCompilationSession({root:new URL('../../',import.meta.url).pathname});
 try{
  const result=session.compileSource({text:fs.readFileSync(new URL('../../frontend/standalone.rmt',import.meta.url),'utf8'),filePath:'frontend/standalone.rmt'});
  assert.equal(result.ok,true);
  const engine=result.orchestrationArtifacts.animationEngine;
  const open=engine.transitions.find(t=>t.id==='search.preview.open'),close=engine.transitions.find(t=>t.id==='search.preview.close');
  assert.deepEqual([open.effect,close.effect],['slide-left','slide-right']);
  for(const transition of [open,close]){assert.equal(transition.interrupt,'replace');assert.equal(transition.reducedMotion,'instant');}
  const media=engine.animations.find(a=>a.id==='search.media.expand');
  assert.equal(media.effect,'shared-element');assert.equal(media.durationMs,320);assert.equal(media.reducedMotion,'instant');
 }finally{session.dispose();}
});
