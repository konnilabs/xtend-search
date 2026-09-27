import {randomUUID} from 'node:crypto';
const types=new Set(['engine.observed','engine.transition','policy.changed','capability.changed','backend.changed','budget.exhausted','probe.requested','telemetry.dropped','feedback.received','quality.proposed','quality.changed']);
const outcomes=new Set(['success','empty','error','skipped','cancelled','unknown']);
const errors=new Set(['timeout','captcha','rate_limit','access_denied','schema_invalid','wrong_result_type','unsafe_url_scheme','backend_unavailable','backend_ingress_limit','backend_suspended','network','unknown',null]);
export function event(type,input={}){
 if(!types.has(type))throw new Error('event_schema');
 const data={};
 for(const name of ['backendId','engineId','capability','origin','reason'])if(typeof input[name]==='string' && input[name].length<=100 && /^[\p{L}\p{N} .:_-]+$/u.test(input[name]))data[name]=input[name];
 if(outcomes.has(input.outcome))data.outcome=input.outcome;
 if(errors.has(input.errorClass))data.errorClass=input.errorClass;
 for(const name of ['durationMs','validResultCount','policyRevision','retryNotBefore','dropped'])if(Number.isFinite(input[name])&&input[name]>=0)data[name]=input[name];
 data.measurementScope=type.startsWith('quality.')||type==='feedback.received'?'quality_feedback':'adapter_round_trip';if(data.measurementScope==='adapter_round_trip')data.providerDurationMs=null;
 return {specversion:'1.0',id:randomUUID(),source:'urn:xtend:search:control-plane:primary',type:`de.ccs-networks.xtend.search.${type}.v1`,time:new Date().toISOString(),datacontenttype:'application/json',dataschema:'urn:xtend:search:schema:operation:v1',data};
}
export class Telemetry {
 constructor(store){this.store=store;this.queue=[];this.recent=[];this.dropped=0;this.sequence=0;this.writing=false;this.closed=false;}
 restore(rows){this.recent=rows.map(r=>({seq:r.seq,...JSON.parse(r.value)}));this.sequence=this.recent.at(-1)?.seq||0;}
 emit(type,data){const e=event(type,data);this.recent.push({seq:++this.sequence,...e});if(this.recent.length>200)this.recent.shift();if(this.queue.length>=256){this.dropped++;return;}this.queue.push(e);void this.flush();}
 async flush(){if(this.writing||!this.queue.length)return;this.writing=true;const batch=this.queue.splice(0,32);try{await this.store.call('events',batch);}catch{this.dropped+=batch.length;}finally{this.writing=false;if(this.queue.length&&!this.closed)setTimeout(()=>void this.flush(),25).unref();}}
 async close(){this.closed=true;while(this.writing)await new Promise(r=>setTimeout(r,10));while(this.queue.length)await this.flush();}
}
