// Native horizontal scrolling; PageClient/RMT remain the navigation/state owners.
export function installCategoryTabs(){
 let nav=null,observer=null,identity='',left=0;
 function align(){
  const next=document.querySelector('.category-tabs');if(!next)return;
  const active=next.querySelector('.tab.active');if(!active)return;
  const key=location.pathname+location.search+':'+next.clientWidth;
  if(next!==nav){observer?.disconnect();nav=next;nav.scrollLeft=left;nav.addEventListener('scroll',()=>{left=nav.scrollLeft;},{passive:true});observer=new ResizeObserver(()=>requestAnimationFrame(align));observer.observe(nav);}
  if(key===identity)return;identity=key;
  const box=nav.getBoundingClientRect(),tab=active.getBoundingClientRect();
  if(tab.left<box.left)nav.scrollLeft+=tab.left-box.left-4;
  else if(tab.right>box.right)nav.scrollLeft+=tab.right-box.right+4;
  left=nav.scrollLeft;
 }
 const schedule=()=>requestAnimationFrame(align);
 window.addEventListener('xtend-page:ready',schedule);
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='navigate')schedule();});
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('pagehide',()=>observer?.disconnect(),{once:true});
}
