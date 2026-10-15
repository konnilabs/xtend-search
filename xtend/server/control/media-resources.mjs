// Shared image bytes only: bounded RAM, no user/session state or persistence.
export class MediaResources {
 constructor({maxActive=12,maxQueued=32,maxEntries=128,maxBytes=32*1024*1024,ttlMs=300000,now=Date.now}={}){Object.assign(this,{maxActive,maxQueued,maxEntries,maxBytes,ttlMs,now});this.active=0;this.bytes=0;this.cache=new Map();this.pending=new Map();this.queue=[];}
 remember(key,value){
  const size=value.body.length;if(size>this.maxBytes)return;
  const old=this.cache.get(key);if(old)this.bytes-=old.size;
  this.cache.delete(key);this.cache.set(key,{value,size,until:this.now()+this.ttlMs});this.bytes+=size;
  while(this.cache.size>this.maxEntries||this.bytes>this.maxBytes){const [first,item]=this.cache.entries().next().value;this.cache.delete(first);this.bytes-=item.size;}
 }
 pump(){while(this.active<this.maxActive&&this.queue.length){const entry=this.queue.shift();if(entry.controller.signal.aborted){entry.reject(entry.controller.signal.reason);continue;}this.active++;Promise.resolve().then(()=>entry.load(entry.controller.signal)).then(value=>{entry.controller.signal.throwIfAborted();this.remember(entry.key,value);entry.resolve(value);},entry.reject).catch(entry.reject).finally(()=>{this.active--;this.pump();});}}
 async load(key,loader,signal){
  signal.throwIfAborted();
  for(const [name,item]of this.cache)if(item.until<=this.now()){this.cache.delete(name);this.bytes-=item.size;}
  const cached=this.cache.get(key);if(cached){this.cache.delete(key);this.cache.set(key,cached);return cached.value;}
  let entry=this.pending.get(key);
  if(entry?.controller.signal.aborted){this.pending.delete(key);entry=null;}
  if(!entry){
   if(this.queue.length>=this.maxQueued)throw Object.assign(Error('media_busy'),{status:429});
   entry={key,load:loader,controller:new AbortController(),users:0};
   entry.promise=new Promise((resolve,reject)=>Object.assign(entry,{resolve,reject})).finally(()=>{if(this.pending.get(key)===entry)this.pending.delete(key);});
   this.pending.set(key,entry);this.queue.push(entry);this.pump();
  }
  entry.users++;
  return new Promise((resolve,reject)=>{
   let done=false;const finish=(fn,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);if(!--entry.users){entry.controller.abort();const index=this.queue.indexOf(entry);if(index>=0){this.queue.splice(index,1);entry.reject(Error('aborted'));}}fn(value);},abort=()=>finish(reject,signal.reason);
   signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();entry.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 }
}
