import test from 'node:test';
import assert from 'node:assert/strict';
import {containedMediaBox,mediaFlipKeyframes} from '../../frontend/media-motion-core.mjs';
test('media morph uses the actual contained image, including letterboxing',()=>{
 const wide=containedMediaBox({x:20,y:100,width:300,height:300},600,300);
 assert.deepEqual(wide,{x:20,y:175,width:300,height:150});
 const tall=containedMediaBox({x:0,y:0,width:1000,height:600},300,600);
 assert.deepEqual(tall,{x:350,y:0,width:300,height:600});
 const frames=mediaFlipKeyframes({x:20,y:100,width:200,height:100},{x:100,y:50,width:800,height:400});
 assert.equal(frames[0].transform,'translate(-380px,-100px) scale(0.25)');
 assert.equal(frames[1].transform,'none');
});
test('zero, missing and non-finite media geometry falls back without animation',()=>{
 for(const bad of [null,{x:0,y:0,width:0,height:2},{x:NaN,y:0,width:2,height:2}]){
  assert.equal(containedMediaBox(bad,600,300),null);
  assert.equal(mediaFlipKeyframes(bad,{x:0,y:0,width:2,height:2}),null);
 }
 assert.equal(containedMediaBox({x:0,y:0,width:10,height:10},0,0),null);
});
