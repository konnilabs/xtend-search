// Secondary RMT work: results never await this scheduler or its resource fetches.
export function installFavicons(){
 let epoch=0,active=0,scheduled=false;const cache=new Map(),queue=[],queued=new Set(),controllers=new Set();let observed=new WeakSet();
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);const src=entry.target.dataset.favicon;if(src&&!queued.has(src)){queued.add(src);queue.push(src);}}pump();},{rootMargin:'100px'});
 const visible=()=>document.querySelectorAll('[data-favicon]');
 function paint(src,bytes){for(const node of visible())if(node.dataset.favicon===src&&!node.querySelector('img')){const image=document.createElement('img');image.alt='';image.width=24;image.height=24;image.decoding='async';image.src=bytes;image.onload=()=>{if(node.isConnected&&node.dataset.favicon===src){node.classList.add('favicon-ready');}};node.append(image);}}
 function scan(){for(const node of visible()){const src=node.dataset.favicon;if(!src)continue;const hit=cache.get(src);if(hit){paint(src,hit);continue;}if(!observed.has(node)){observed.add(node);observer.observe(node);}}}
 function pump(){while(active<2&&queue.length){const src=queue.shift(),own=epoch,c=new AbortController();controllers.add(c);active++;
  fetch(src,{signal:c.signal,priority:'low',credentials:'same-origin',referrerPolicy:'no-referrer'}).then(async response=>{if(!response.ok||response.status===204)return;const blob=await response.blob();if(blob.type!=='image/png'||own!==epoch)return;const url=URL.createObjectURL(blob);cache.set(src,url);if(cache.size>300){const [key,value]=cache.entries().next().value;URL.revokeObjectURL(value);cache.delete(key);}paint(src,url);}).catch(()=>{}).finally(()=>{controllers.delete(c);active--;pump();});
 }}
 function schedule(){if(scheduled)return;const scheduler=window.XTendPage?.getRuntime()?.getScheduler?.();if(!scheduler){scheduled=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{scheduled=false;scan();}));return;}scheduled=true;scheduler.schedule({lane:'background',priority:5,strategy:'after_paint',coalesceKey:'search-favicons',endpointName:'search.favicons',scope:'search'},()=>{scheduled=false;scan();}).catch(()=>{scheduled=false;});}
 function reset(){epoch++;for(const c of controllers)c.abort();queue.length=0;queued.clear();observer.disconnect();observed=new WeakSet();scheduled=false;}
 window.addEventListener('xtend-search:stream',schedule);
 window.addEventListener('xtend-page:event',({detail})=>{if(detail.type==='pending')reset();if(detail.type==='navigate')schedule();});
 window.addEventListener('pagehide',()=>{reset();for(const url of cache.values())URL.revokeObjectURL(url);cache.clear();});
 const mutation=new MutationObserver(schedule);mutation.observe(document.getElementById('xtend-page')||document.body,{childList:true,subtree:true});
 schedule();
}
