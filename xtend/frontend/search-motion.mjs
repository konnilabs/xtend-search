import {XUtils} from '@ccslabs/xtend/components/xutils.js';

// PageClient owns commits/history. XUtils decorates only home/result changes.
// One keyed form and wordmark stay mounted; no clones or navigation delays.
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
 const flip=(target,rect,layoutKey)=>{
  const after=target?.getBoundingClientRect();
  if(!rect?.width||!rect.height||!after?.width||!after.height)return;
  const transform=`translate(${rect.x-after.x}px,${rect.y-after.y}px) scale(${rect.width/after.width},${rect.height/after.height})`;
  run(target,{effect:'layout-flip',layoutKey,keyframes:[{transform,transformOrigin:'0 0'},{transform:'none',transformOrigin:'0 0'}]});
 };
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){
   stop();
   before={form:document.querySelector('#search-form')?.getBoundingClientRect(),wordmark:document.querySelector('#search-wordmark')?.getBoundingClientRect()};
  }
  if(event.type==='navigate'){
   const next=document.querySelector('#search-shell')?.dataset.view;
   if(next===view)return; // Optimistic XScaler commits are not layout changes.
   if(before&&!motion.matches){
    flip(document.querySelector('#search-form'),before.form,'xtend-search-form');
    flip(document.querySelector('#search-wordmark'),before.wordmark,'xtend-search-wordmark');
    if(next==='results'){
     run(document.querySelector('.header-backdrop'),{effect:'fade'});
     run(document.querySelector('#search-logo'),{effect:'fade'});
    }
   }
   view=next;before=null;
  }
  if(event.type==='error'){before=null;stop();}
 });
 window.addEventListener('resize',stop,{passive:true});
 motion.addEventListener('change',stop);
 window.addEventListener('pagehide',stop,{once:true});
}
