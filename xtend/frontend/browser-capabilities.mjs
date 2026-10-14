// Narrow browser I/O ports. These never create nodes, change visual attributes,
// or own a renderer/router. Call only after a current XTend lifecycle commit.
export const focusElement=(target,options)=>target?.focus?.(options);
export const scrollElement=(target,...position)=>target?.scrollTo?.(...position);
export const revealElement=(target,options)=>target?.scrollIntoView?.(options);
export const scrollViewport=(...position)=>window.scrollTo(...position);

// Classic XAlert has no public autofocus=false capability in the pinned SDK.
// Its published alert-shown event precedes one focus microtask. Restore the
// previous user focus after that microtask, without touching its Shadow DOM.
export function installInlineNoticeFocus(){
 const lifetime=new AbortController();
 document.addEventListener('alert-shown',event=>{
  const notice=event.target;if(!notice.matches?.('x-alert.search-warning'))return;
  const previous=document.activeElement;
  queueMicrotask(()=>queueMicrotask(()=>{
   if(!notice.isConnected||document.activeElement!==notice)return;
   const target=previous?.isConnected&&previous!==document.body?previous:document.getElementById('search-input');
   focusElement(target,{preventScroll:true});
  }));
 },{signal:lifetime.signal});
 window.addEventListener('pagehide',()=>lifetime.abort(),{once:true});
}
