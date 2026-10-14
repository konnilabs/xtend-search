import {focusElement} from './browser-capabilities.mjs';
// Media state is an AppService result; RMT renders the dialog and all controls.
import {createAppServiceRegistry} from '@ccslabs/xtend/maraca/app-services';
import services from './services.ts';
import {updateOverlay} from './overlay-controller.mjs';
export function createSearchLightbox({onSelect}){
 const registry=createAppServiceRegistry(services,{historyLimit:0});let entries=[],active=false,revision=0,touch=null;
 const runtime=()=>window.XTendPage.getRuntime(),state=()=>runtime().model.getState('search.overlay');
 const commit=patch=>{const own=revision;return updateOverlay(patch,()=>own===revision);};
 async function show(id,initial=false){const own=++revision;const media=await registry.invoke('search.media.select',{items:entries,id,key:String(own)});if(!media||own!==revision||!active)return;await commit({lightbox:true,media});if(!initial)await onSelect(id);}
 async function open(items,id){entries=items;active=true;await runtime().ensureComponent('x-dialog');if(active)await show(id,true);}
 function close({focus=true}={}){if(!active)return;active=false;revision++;void commit({lightbox:false,media:{}}).then(()=>{if(focus)focusElement(document.getElementById('preview-expand'), {preventScroll:true});}).catch(()=>{});}
 async function move(delta){if(!active)return;const id=await registry.invoke('search.media.move',{items:entries,id:state().media.id,delta});if(id)await show(id);}
 document.addEventListener('click',event=>{const button=event.target.closest?.('#search-lightbox [data-lightbox-action]');if(!button||!active)return;event.preventDefault();void move(button.dataset.lightboxAction==='next'?1:-1);});
 document.addEventListener('dialog-closed',event=>{if(event.target.id==='search-lightbox')close();});
 for(const type of ['load','error'])document.addEventListener(type,async event=>{const image=event.target,media=state().media;if(!active||image.id!=='lightbox-image'||image.dataset.imageRequest!==media.key||image.getAttribute('src')!==media.src)return;const own=revision;const next=type==='error'?await registry.invoke('search.media.failure',media):{...media,loading:false,message:media.imageError?media.message:media.fallbackUsed?'Das Original ist nicht erreichbar. Angezeigt wird das Vorschaubild.':''};if(active&&own===revision)await commit({media:next});},true);
 document.addEventListener('keydown',event=>{if(!active||event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;if(['ArrowLeft','ArrowRight','Home','End','/'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='ArrowLeft')void move(-1);if(event.key==='ArrowRight')void move(1);if(event.key==='Home')void show(entries[0]?.id);if(event.key==='End')void show(entries.at(-1)?.id);}},true);
 document.addEventListener('pointerdown',event=>{if(active&&event.pointerType==='touch'&&event.target.closest?.('#search-lightbox')&&!event.target.closest('button,a'))touch={x:event.clientX,y:event.clientY};});
 document.addEventListener('pointerup',event=>{if(!touch||!active)return;const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3)void move(dx<0?1:-1);});
 document.addEventListener('pointercancel',()=>touch=null);
 window.addEventListener('pagehide',()=>{active=false;revision++;registry.dispose();},{once:true});
 return {open,close,isOpen:()=>active,updateEntries(items){entries=items;if(active){const id=state().media.id;if(!entries.some(item=>item.id===id))close();else void show(id,true);}}};
}
