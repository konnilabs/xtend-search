import {focusElement,revealElement} from './browser-capabilities.mjs';
// Integration events select normalized results; RMT owns the panel and its DOM.
export function installImagePreview(command){
 let selectedId='',returnId='',imageSrc='',epoch=0,pending=false,viewer=null,viewerPromise=null,expandEpoch=0;
 let imageRequest=null,requestId=0,imageTimer=null;
 function request(src){
  clearTimeout(imageTimer);imageTimer=null;
  imageSrc=src;
  imageRequest=src?{key:String(++requestId),src,selection:selectedId,epoch}:null;
  if(imageRequest){const attempt=imageRequest;imageTimer=setTimeout(()=>failRequest(attempt),8000);}
  return imageRequest?.key || '';
 }
 const images=()=>{
  const data=window.XTendPage?.page?.props?.['search.data'];
  return data?.category==='images'?data.results.filter(result=>result.previewId):[];
 };
 async function open(id,focus=false){
  if(pending)return;
  const entries=images(),index=entries.findIndex(result=>result.id===id);if(index<0)return;
  const result=entries[index],current=++epoch;expandEpoch++;
  selectedId=id;returnId=id;const imageKey=request(result.previewSrc);
  await command('search.preview.open',{value:{...result,open:true,imageSrc,imageKey,imageLoading:!!imageSrc,expansionLoading:false,expansionToken:'',imageUnavailable:false,imageMessage:'',expandMessage:'',position:`Bild ${index+1} von ${entries.length}`,previousDisabled:index===0,nextDisabled:index===entries.length-1}});
  if(current!==epoch || !focus)return;
  focusElement(document.getElementById('preview-close'), {preventScroll:true});
  if(matchMedia('(max-width: 960px)').matches)revealElement(document.getElementById('image-preview'), {block:'start'});
 }
 async function expand(){
  if(pending || !selectedId)return;
  const current=++expandEpoch,id=selectedId,token=String(current);let timer;
  await command('search.preview.update',{value:{type:'expansion',id,token,busy:true}});
  try{
   viewerPromise ||= import('./lightbox.mjs').then(module=>module.createSearchLightbox({onSelect:id=>open(id)})).catch(error=>{viewerPromise=null;throw error;});
   const loaded=await Promise.race([viewerPromise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lightbox timeout')),8000);})]);viewer=loaded;
   if(current!==expandEpoch || pending || selectedId!==id)return;
   await viewer.open(images(),id);
   if(current===expandEpoch&&!pending&&selectedId===id)await command('search.preview.update',{value:{type:'expansion',id,token,busy:false}});
  }catch{
   if(current===expandEpoch&&!pending&&selectedId===id)await command('search.preview.update',{value:{type:'expansion',id,token,busy:false,message:'Die Vollbildansicht konnte nicht geladen werden. Die Bildvorschau und der Original-Link bleiben verfügbar.'}});
  }finally{clearTimeout(timer);}
 }
 async function close(){
  expandEpoch++;viewer?.close({focus:false});
  const id=returnId,current=++epoch;selectedId='';request('');
  await command('search.preview.close');
  if(current!==epoch)return;
  const target=Array.from(document.querySelectorAll('a[data-preview-id]')).find(link=>link.dataset.previewId===id);
  focusElement((target || document.getElementById('search-input')), {preventScroll:false});
 }
 function move(delta){
  const entries=images(),index=entries.findIndex(result=>result.id===selectedId);
  if(index>=0 && entries[index+delta])void open(entries[index+delta].id);
 }
 document.addEventListener('click',event=>{
  if(event.defaultPrevented || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !window.XTendPage)return;
  const link=event.target.closest?.('a[data-preview-id]');
  if(link?.dataset.previewId){if(pending)return;event.preventDefault();void open(link.dataset.previewId,true);return;}
  const control=event.target.closest?.('button[data-preview-action]');
  if(!control)return;event.preventDefault();
  if(control.dataset.previewAction==='expand')void expand();
  else if(control.dataset.previewAction==='close')void close();
  else move(control.dataset.previewAction==='previous'?-1:1);
 });
 function failRequest(attempt){
  if(pending||!attempt||imageRequest!==attempt||attempt.selection!==selectedId||attempt.epoch!==epoch)return;
  // Consume exactly this attempt. Late/duplicate failures cannot affect a new image.
  imageRequest=null;clearTimeout(imageTimer);imageTimer=null;
  const result=images().find(result=>result.id===selectedId);
  const fallback=result?.thumbnail && attempt.src!==result.thumbnail?result.thumbnail:'';
  const imageKey=request(fallback);
  if(!fallback && document.activeElement?.id==='preview-expand')focusElement(document.getElementById('preview-close'), {preventScroll:true});
  void command('search.preview.update',{value:{type:'failure',expectedKey:attempt.key,src:fallback,key:imageKey,unavailable:!fallback,message:fallback?'Das große Bild ist nicht erreichbar. Hier siehst du die kleine Vorschau.':'Die Vorschau ist nicht erreichbar. Du kannst die Quellseite oder das Originalbild öffnen.'}});
 }
 for(const type of ['load','error'])document.addEventListener(type,event=>{
  const img=event.target,attempt=imageRequest;
  if(pending||!attempt||img.id!=='preview-image'||!img.isConnected||img!==document.getElementById('preview-image')||img.dataset.imageRequest!==attempt.key||img.getAttribute('src')!==attempt.src||attempt.selection!==selectedId||attempt.epoch!==epoch)return;
  if(type==='error'){failRequest(attempt);return;}
  imageRequest=null;clearTimeout(imageTimer);imageTimer=null;
  void command('search.preview.update',{value:{type:'loaded',key:attempt.key}});
 },true);
 window.addEventListener('keydown',event=>{
  // XDialog may synchronously close before this bubbling event reaches window.
  // Its Escape belongs to the modal layer, even after the host is detached.
  if(event.composedPath().some(node=>node?.id==='search-lightbox'))return;
  if(document.querySelector('#search-about[open],#search-feedback[open]'))return;
  if(event.defaultPrevented || viewer?.isOpen() || !selectedId || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();void close();return;}
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable)return;
  if(event.key==='ArrowLeft' || event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}
 });
 window.addEventListener('xtend-page:event',({detail:event})=>{
  if(event.type==='pending'){pending=true;expandEpoch++;viewer?.close({focus:false});epoch++;selectedId='';returnId='';request('');}
  if(event.type==='navigate' || event.type==='error')pending=false;
  if(event.type==='navigate' && selectedId){
   const entries=images(),index=entries.findIndex(entry=>entry.id===selectedId);
   if(index<0){void close();return;}
   void command('search.preview.position',{position:`Bild ${index+1} von ${entries.length}`,previousDisabled:index===0,nextDisabled:index===entries.length-1});
   viewer?.updateEntries(entries);
  }
 });
 window.addEventListener('pagehide',()=>{epoch++;expandEpoch++;request('');});
}
