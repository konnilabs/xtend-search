import {Worker} from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
export class Store {
 constructor(directory){
  fs.mkdirSync(directory,{recursive:true,mode:0o700});this.pending=new Map();this.sequence=0;this.failed=false;
  // Container entrypoint owns an OS flock for the full process lifetime.
  this.worker=new Worker(new URL('./storage-worker.mjs',import.meta.url),{workerData:{file:path.join(directory,'control-plane.sqlite')}});
  this.ready=new Promise((resolve,reject)=>{
   const unavailable=()=>{this.failed=true;clearTimeout(bootTimer);reject(new Error('storage_unavailable'));for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('storage_unavailable'));}this.pending.clear();};
   const bootTimer=setTimeout(()=>{unavailable();void this.worker.terminate();},5000);
   this.worker.on('message',message=>{if(message.ready){clearTimeout(bootTimer);resolve();return;}const p=this.pending.get(message.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(message.id);message.error?p.reject(Object.assign(new Error(message.error),{code:message.error})):p.resolve(message.value);});
   this.worker.on('error',unavailable);
   this.worker.on('exit',()=>{if(!this.closed)unavailable();});
  });
 }
 async call(op,data){await this.ready;if(this.failed||this.pending.size>=64)throw new Error('storage_unavailable');const id=++this.sequence;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.failed=true;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('storage_unavailable'));}this.pending.clear();void this.worker.terminate();},5000);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({id,op,data});});}
 async close(){if(this.closed)return;this.closed=true;try{await this.call('close');}finally{await this.worker.terminate();}}
}
