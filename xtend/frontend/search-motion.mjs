import {XUtils} from '@ccslabs/xtend/components/xutils.js';

// PageClient owns commits/history. XUtils decorates only home/result changes.
// One keyed form stays mounted; no cloned controls or navigation delays.
export function installSearchMotion(){
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),owned=new Set();
 let before=null,view=document.querySelector('#search-shell')?.dataset.view;
 const stop=()=>{for(const animation of owned)animation.cancel();owned.clear();};
 const run=(target,input)=>{
  if(!target?.animate||!target.getAnimations||motion.matches)return;
  const existing=new Set(target.getAnimations());
  const work=XUtils.runUiTransition({target,body:false,phase:'enter',durationMs:320,easing:'cubic-bezier(.2,.8,.2,1)',...input});
  const created=target.getAnimations().filter(a=>!existing.has(a));
  for(const animation of created)owned.add(animation);
  void work.catch(()=>{}).finally(()=>{for(const animation of created){animation.cancel();owned.delete(animation);}});
 };
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){
   before=document.querySelector('#search-form')?.getBoundingClientRect();stop();
  }
  if(event.type==='navigate'){
   const next=document.querySelector('#search-shell')?.dataset.view;
   if(next===view)return; // Optimistic XScaler commits are not layout changes.
   const form=document.querySelector('#search-form'),after=form?.getBoundingClientRect();
   if(before&&after?.width&&after.height&&!motion.matches){
    const transform=`translate(${before.x-after.x}px,${before.y-after.y}px) scale(${before.width/after.width},${before.height/after.height})`;
    run(form,{effect:'layout-flip',layoutKey:'xtend-search-form',keyframes:[{transform,transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}]});
    if(next==='results')run(document.querySelector('.header-backdrop'),{effect:'fade'});
   }
   view=next;before=null;
  }
  if(event.type==='error'){before=null;stop();}
 });
 window.addEventListener('resize',stop,{passive:true});
 motion.addEventListener('change',stop);
 window.addEventListener('pagehide',stop,{once:true});
}
