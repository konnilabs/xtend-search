export const IMAGE_PLACEHOLDER='/assets/xtend/image-placeholder.svg';

// Failed thumbnails are presentation state. Keep original page data/links intact.
export function installResultImages(command){
 let pending=false,scheduled=false,generation=0,streamId=null;
 const failed=new Set();
 let errors=new WeakMap();
 const data=()=>window.XTendPage?.page?.props?.['search.data'];
 const present=results=>results.map(result=>failed.has(result.thumbnail)?{...result,thumbnail:IMAGE_PLACEHOLDER,thumbnailKey:result.thumbnailKey+':unavailable',thumbnailAlt:'Bild nicht verfügbar',thumbnailFailed:true}:result);
 function flush(){
  if(scheduled || pending || !data() || !failed.size)return;
  scheduled=true;const current=generation;
  requestAnimationFrame(()=>{
   scheduled=false;if(pending)return;if(current!==generation){flush();return;}
   const results=data()?.results;if(!results)return;
   void command('search.images.set',{value:{results:present(results)}});
  });
 }
 function unavailable(img){
  if(pending || !img.matches?.('img[data-result-image]') || !img.isConnected || !img.complete || img.naturalWidth>0)return;
  const src=img.getAttribute('src');
  if(!(src?.startsWith('/image_proxy?') || src?.startsWith('/media?')) || failed.has(src))return;
  failed.add(src);flush();
 }
 function scan(initial=false){
  for(const img of document.querySelectorAll('img[data-result-image]')){
   // Firefox can briefly report complete/zero width before a newly inserted
   // lazy image starts loading. Only initial SSR may have missed error events;
   // subsequent commits must use an observed error for this node and source.
   if(initial || errors.get(img)===img.getAttribute('src'))unavailable(img);
  }
  flush();
 }
 document.addEventListener('error',event=>{
  const img=event.target;
  if(!img.matches?.('img[data-result-image]') || !img.complete || img.naturalWidth>0)return;
  errors.set(img,img.getAttribute('src'));unavailable(img);
 },true);
 window.addEventListener('xtend-page:ready',()=>scan(true));
 window.addEventListener('xtend-page:event',async({detail:event})=>{
  if(event.type==='pending'){pending=true;generation++;failed.clear();errors=new WeakMap();}
  if(event.type==='navigate'){
   pending=false;const current=++generation,nextStream=data()?.stream?.id;
   if(!nextStream || nextStream!==streamId)failed.clear();
   streamId=nextStream;
   // Equal page props can be skipped by Maraca: a new search must retry images.
   await command('search.images.set',{value:{results:present(data()?.results || [])}});
   if(current===generation && !pending)scan();
  }
  if(event.type==='error'){pending=false;scan();}
 });
}
