import {XUtils} from '@ccslabs/xtend/components/xutils.js';
import {mediaMotionPreset} from '../.xtend-build/media-motion.mjs';
import {containedMediaBox,mediaFlipKeyframes} from './media-motion-core.mjs';
// The compiler owns the RMT preset. This geometry port supplies the same public
// XUtils AnimationEngine runner used by the header, restricted to transform/opacity.
export function capturePreviewMedia(){
 const image=document.getElementById('preview-image');
 if(!image?.naturalWidth||!image.naturalHeight)return null;
 const box=containedMediaBox(image.getBoundingClientRect(),image.naturalWidth,image.naturalHeight);
 if(!box||box.y>=innerHeight||box.y+box.height<=0)return null;
 return {box,width:image.naturalWidth,height:image.naturalHeight};
}
export function createMediaMotion(){
 const owned=new Set(),preference=matchMedia('(prefers-reduced-motion:reduce)');
 const stop=()=>{for(const animation of owned)animation.cancel();owned.clear();};
 function expand(source,target){
  stop();if(!source||!target?.animate||preference.matches)return;
  const to=containedMediaBox(target.getBoundingClientRect(),target.naturalWidth||source.width,target.naturalHeight||source.height),keyframes=mediaFlipKeyframes(source.box,to);
  if(!keyframes)return;
  const before=new Set(target.getAnimations());
  const work=XUtils.runUiTransition({...mediaMotionPreset,target,body:false,layoutKey:'search-image-media',phase:'enter',keyframes});
  const created=target.getAnimations().filter(animation=>!before.has(animation));for(const animation of created)owned.add(animation);
  void work.catch(()=>{}).finally(()=>{for(const animation of created){animation.cancel();owned.delete(animation);}});
 }
 window.addEventListener('resize',stop,{passive:true});preference.addEventListener('change',stop);
 window.addEventListener('pagehide',()=>{stop();preference.removeEventListener('change',stop);window.removeEventListener('resize',stop);},{once:true});
 return {expand,stop};
}
