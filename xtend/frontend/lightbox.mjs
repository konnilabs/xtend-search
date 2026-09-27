// Classic XTend owns the image/dialog. The app supplies the current-page carousel.
// The build adds one named controls slot; the pinned SDK and local checkout stay intact.
import '@ccslabs/xtend/components/xlightbox.js';
import {IMAGE_PLACEHOLDER} from './images.mjs';

function focusable(root){
 const result=[];
 function visit(node){
  if(!(node instanceof Element))return;
  if(node.matches('button,a[href],input,select,textarea,[tabindex]') && node.tabIndex>=0 && !node.disabled && !node.inert && node.getClientRects().length)result.push(node);
  const children=node instanceof HTMLSlotElement?node.assignedElements({flatten:true}):node.shadowRoot?node.shadowRoot.children:node.children;
  for(const child of children)visit(child);
 }
 visit(root);return result;
}

export function createSearchLightbox({onSelect}){
 const box=document.createElement('x-lightbox');box.id='search-lightbox';box.className='search-lightbox';
 const controls=document.createElement('div');controls.slot='controls';controls.className='lightbox-controls';
 // Static chrome only. All provider-supplied strings below use textContent/attributes.
 controls.innerHTML=`<button class="lightbox-step lightbox-previous" type="button" data-lightbox-action="previous" aria-label="Vorheriges Bild im Vollbild"><span class="preview-arrow" aria-hidden="true"></span></button>
 <button class="lightbox-step lightbox-next" type="button" data-lightbox-action="next" aria-label="Nächstes Bild im Vollbild"><span class="preview-arrow" aria-hidden="true"></span></button>
 <div class="lightbox-caption"><p class="lightbox-position" role="status" aria-live="polite" aria-atomic="true"></p><h2 class="lightbox-title"></h2><p class="lightbox-message" role="status" aria-live="polite"></p><div class="lightbox-links"><a class="lightbox-source" data-xtend-native rel="noreferrer">Seite besuchen ↗</a><a class="lightbox-original" data-xtend-native rel="noreferrer">Originalbild öffnen ↗</a></div></div>`;
 box.append(controls);document.body.append(box);
 const ui=Object.fromEntries(['position','title','message','source','original'].map(key=>[key,controls.querySelector('.lightbox-'+key)]));
 let entries=[],index=-1,active=false,activeSrc='',fallbackUsed=false,returnFocus=true,inertStates=new Map(),overflow='',touch=null;
 const isOpen=()=>active;
 function unlock(){for(const [node,value] of inertStates)node.inert=value;inertStates.clear();document.documentElement.style.overflow=overflow;}
 function lock(){overflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';for(const node of document.body.children){if(node===box)continue;inertStates.set(node,node.inert);node.inert=true;}}
 function show(next,{initial=false}={}){
  if(!entries.length)return;
  index=(next+entries.length)%entries.length;const entry=entries[index];
  activeSrc=entry.previewSrc;fallbackUsed=false;box.removeAttribute('data-image-error');box.setAttribute('data-loading','');
  ui.position.textContent=`Bild ${index+1} von ${entries.length}`;ui.title.textContent=entry.title;ui.message.textContent='Bild wird geladen …';
  ui.source.href=entry.url;ui.original.hidden=!entry.imageUrl;ui.original.href=entry.imageUrl || entry.url;
  for(const button of controls.querySelectorAll('.lightbox-step'))button.disabled=entries.length<2;
  box.setAttribute('alt',entry.title);box.setAttribute('src',activeSrc);
  if(initial)box.open(activeSrc);
  else void onSelect(entry.id);
 }
 function open(items,id){
  const next=items.filter(item=>item.previewId && (item.previewSrc.startsWith('/image_proxy?') || item.previewSrc.startsWith('/media?')));
  const selected=next.findIndex(item=>item.id===id);if(selected<0)return false;
  entries=next;returnFocus=true;
  if(!active){lock();active=true;show(selected,{initial:true});}else show(selected);
  return true;
 }
 function close({focus=true}={}){
  if(!active)return;returnFocus=focus;box.close({source:'search-carousel',immediate:!focus});
 }
 box.addEventListener('lightbox-closed',()=>{
  active=false;touch=null;unlock();entries=[];index=-1;activeSrc='';
  box.removeAttribute('src');box.removeAttribute('alt');box.removeAttribute('data-loading');box.removeAttribute('data-image-error');
  if(returnFocus)(document.getElementById('preview-expand') || document.getElementById('preview-close') || document.getElementById('search-input'))?.focus({preventScroll:true});
 });
 controls.addEventListener('click',event=>{
  const action=event.target.closest('[data-lightbox-action]')?.dataset.lightboxAction;
  if(!action || !active)return;event.preventDefault();show(index+(action==='next'?1:-1));
 });
 // Media load/error events do not cross a shadow boundary. Use the published media part,
 // without changing or replacing component-owned nodes.
 box.shadowRoot.addEventListener('load',event=>{
  if(!active || !event.target.matches?.('[part~="media"]') || event.target.getAttribute('src')!==activeSrc)return;
  box.removeAttribute('data-loading');if(box.hasAttribute('data-image-error'))return;ui.message.textContent=fallbackUsed?'Das Original ist nicht erreichbar. Angezeigt wird das Vorschaubild.':'';
 },true);
 box.shadowRoot.addEventListener('error',event=>{
  if(!active || !event.target.matches?.('[part~="media"]') || event.target.getAttribute('src')!==activeSrc)return;
  if(!event.target.complete || event.target.naturalWidth>0 || activeSrc===IMAGE_PLACEHOLDER)return;
  const thumb=entries[index]?.thumbnail;
  if(!fallbackUsed && thumb && thumb!==activeSrc){fallbackUsed=true;activeSrc=thumb;box.setAttribute('src',thumb);return;}
  box.removeAttribute('data-loading');box.setAttribute('data-image-error','');
  ui.message.textContent='Dieses Bild ist nicht erreichbar. Du kannst weiterblättern oder die Quelle öffnen.';
  activeSrc=IMAGE_PLACEHOLDER;box.setAttribute('src',activeSrc);
 },true);
 document.addEventListener('keydown',event=>{
  if(!active || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)return;
  const key=event.key;
  if(!['Escape','ArrowLeft','ArrowRight','Home','End','Tab','/'].includes(key))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(key==='Escape'){close();return;}
  if(key==='Tab'){
   const nodes=focusable(box),current=nodes.indexOf(event.composedPath()[0]);
   nodes[(current+(event.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();return;
  }
  if(key==='ArrowLeft')show(index-1);if(key==='ArrowRight')show(index+1);
  if(key==='Home')show(0);if(key==='End')show(entries.length-1);
 },true);
 box.addEventListener('pointerdown',event=>{if(event.pointerType==='touch' && !event.composedPath().some(node=>node instanceof Element && node.matches('button,a')))touch={x:event.clientX,y:event.clientY};});
 box.addEventListener('pointerup',event=>{if(!touch || !active)return;const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch=null;if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.3)show(index+(dx<0?1:-1));});
 box.addEventListener('pointercancel',()=>touch=null);
 function updateEntries(items){
  if(!active)return;
  const id=entries[index]?.id,next=items.filter(item=>item.previewId && (item.previewSrc.startsWith('/image_proxy?') || item.previewSrc.startsWith('/media?')));
  const selected=next.findIndex(item=>item.id===id);
  if(selected<0){close();return;}
  entries=next;index=selected;ui.position.textContent=`Bild ${index+1} von ${entries.length}`;
  for(const button of controls.querySelectorAll('.lightbox-step'))button.disabled=entries.length<2;
 }
 return {open,close,isOpen,updateEntries};
}
