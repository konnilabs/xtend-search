import '@ccslabs/xtend/components/xdialog.js';
import {aboutContent} from '../shared/about.mjs';
import {VERSION} from '../server/control/release.mjs';
export async function createAboutDialog(){
 let timer;
 try{await Promise.race([customElements.whenDefined('x-dialog'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Dialog unavailable')),6000);})]);}
 finally{clearTimeout(timer);}
 const box=document.createElement('x-dialog'),copy=aboutContent('de',VERSION);
 box.id='search-about';box.className='search-about';box.setAttribute('overlay','');box.setAttribute('title',copy.title);box.setAttribute('width','min(680px, calc(100vw - 32px))');
 // Only the shared, static product copy; no user strings are inserted as HTML.
 box.innerHTML=copy.html;document.body.append(box);
 let active=false,opener=null,overflow='',position=[0,0];const inertStates=new Map();
 box.addEventListener('dialog-opened',()=>{
  active=true;position=[scrollX,scrollY];overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';
  for(const node of document.body.children){if(node===box)continue;inertStates.set(node,node.inert);node.inert=true;}
 });
 box.addEventListener('dialog-closed',()=>{
  active=false;for(const [node,value]of inertStates)node.inert=value;inertStates.clear();document.documentElement.style.overflow=overflow;
  // XDialog owns the focus trap. Restore its trigger without a scroll jump,
  // after the component's own focus-return microtask has completed.
  queueMicrotask(()=>queueMicrotask(()=>{if(!active&&opener?.isConnected){opener.focus({preventScroll:true});scrollTo(...position);}}));
 });
 return {open(link){if(active)return;opener=link;link.focus({preventScroll:true});box.open();},close(){if(active)box.close({source:'navigation'});}};
}
