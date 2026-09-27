// Integration events select normalized results; RMT owns the panel and its DOM.
export function installImagePreview(command){
 let selectedId='',returnId='',imageSrc='',epoch=0,pending=false,viewer=null,viewerPromise=null,expandEpoch=0;
 let imageRequest=null,requestId=0;
 function request(src){
  imageSrc=src;
  imageRequest=src?{key:String(++requestId),src,selection:selectedId,epoch}:null;
  return imageRequest?.key || '';
 }
 const images=()=>{
  const data=window.XTendPage?.page?.props?.['search.data'];
  return data?.category==='images'?data.results.filter(result=>result.previewId):[];
 };
 async function open(id,focus=false){
  if(pending)return;
  const entries=images(),index=entries.findIndex(result=>result.id===id);if(index<0)return;
  const result=entries[index],current=++epoch;
  selectedId=id;returnId=id;const imageKey=request(result.previewSrc);
  await command('search.preview.open',{value:{...result,open:true,imageSrc,imageKey,imageUnavailable:false,imageMessage:'',expandMessage:'',position:`Bild ${index+1} von ${entries.length}`,previousDisabled:index===0,nextDisabled:index===entries.length-1}});
  if(current!==epoch || !focus)return;
  document.getElementById('preview-close')?.focus({preventScroll:true});
  if(matchMedia('(max-width: 960px)').matches)document.getElementById('image-preview')?.scrollIntoView({block:'start'});
 }
 async function expand(){
  if(pending || !selectedId)return;
  const current=++expandEpoch,id=selectedId;
  await command('search.preview.expansion',{message:'Vollbildansicht wird geladen …'});
  try{
   viewerPromise ||= import('./lightbox.mjs').then(module=>module.createSearchLightbox({onSelect:id=>open(id)}));
   const loaded=await viewerPromise;viewer=loaded;
   if(current!==expandEpoch || pending || selectedId!==id)return;
   await command('search.preview.expansion',{message:''});
   if(current===expandEpoch && !pending && selectedId===id)viewer.open(images(),id);
  }catch{
   viewerPromise=null;
   if(current===expandEpoch && !pending)await command('search.preview.expansion',{message:'Die Vollbildansicht konnte nicht geladen werden. Die Bildvorschau und der Original-Link bleiben verfügbar.'});
  }
 }
 async function close(){
  expandEpoch++;viewer?.close({focus:false});
  const id=returnId,current=++epoch;selectedId='';request('');
  await command('search.preview.close');
  if(current!==epoch)return;
  const target=Array.from(document.querySelectorAll('a[data-preview-id]')).find(link=>link.dataset.previewId===id);
  (target || document.getElementById('search-input'))?.focus({preventScroll:false});
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
 document.addEventListener('error',event=>{
  const img=event.target,attempt=imageRequest;
  if(pending || !attempt || img.id!=='preview-image' || !img.isConnected || img!==document.getElementById('preview-image') || img.dataset.imageRequest!==attempt.key || img.getAttribute('src')!==attempt.src || attempt.selection!==selectedId || attempt.epoch!==epoch)return;
  // Consume exactly this attempt. Late/duplicate failures cannot affect a new image.
  imageRequest=null;
  const result=images().find(result=>result.id===selectedId);
  const fallback=result?.thumbnail && attempt.src!==result.thumbnail?result.thumbnail:'';
  const imageKey=request(fallback);
  if(!fallback && document.activeElement?.id==='preview-expand')document.getElementById('preview-close')?.focus({preventScroll:true});
  void command('search.preview.error',{src:fallback,key:imageKey,unavailable:!fallback,message:fallback?'Das große Bild ist nicht erreichbar. Hier siehst du die kleine Vorschau.':'Die Vorschau ist nicht erreichbar. Du kannst die Quellseite oder das Originalbild öffnen.'});
 },true);
 window.addEventListener('keydown',event=>{
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
}
