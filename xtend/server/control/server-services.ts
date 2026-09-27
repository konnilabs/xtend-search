import {defineServerServices,service} from '@ccslabs/xtend/maraca/app-services';
import {application} from './composition.mjs';
import {parseSearch} from '../search.mjs';
export default defineServerServices({
 'search.run':service({kind:'stream',target:'server',concurrency:'parallel',async *stream(input: {url:string},context){
  if(typeof input.url!=='string'||!input.url.startsWith('/search?')||input.url.length>12000)throw new Error('Invalid search');
  const state=parseSearch(new URL(input.url,'http://localhost'));
  for await(const payload of application().search.run(state,context))yield {type:payload.event==='search.summary'?'complete':'delta',value:payload};
 }}),
 'search.feedback.submit':service({kind:'command',target:'server',invoke(input,context){return application().quality.submit(input,context);}}),
 'search.capabilities':service({kind:'query',target:'server',invoke(){return application().search.base({q:'',category:'general',language:'all',timeRange:'',safeSearch:'1',page:1}).tabs.map((t: {id:string,label:string})=>({id:t.id,label:t.label}));}}),
 'admin.quality.rule.set':service({kind:'command',target:'server',invoke(input,context){return application().admin.quality('rule',input,context);}}),
 'admin.quality.decision':service({kind:'command',target:'server',invoke(input,context){return application().admin.quality('decision',input,context);}}),
 'admin.quality.resume':service({kind:'command',target:'server',invoke(input,context){return application().admin.quality('resume',input,context);}}),
 'admin.quality.evidence':service({kind:'query',target:'server',invoke(input,context){return application().admin.evidence(input,context);}}),
 'admin.quality.simulate':service({kind:'query',target:'server',invoke(input,context){return application().admin.simulate(input,context);}}),
 'admin.observatory.snapshot':service({kind:'query',target:'server',invoke(input,context){return application().admin.snapshot(input,context);}}),
 'admin.observatory.events':service({kind:'stream',target:'server',concurrency:'parallel',stream(input,context){return application().admin.events(input,context);}}),
 'admin.engine.policy.set':service({kind:'command',target:'server',invoke(input,context){return application().admin.mutate('policy',input,context);}}),
 'admin.engine.drain':service({kind:'command',target:'server',invoke(input,context){return application().admin.mutate('drain',input,context);}}),
 'admin.engine.probe.request':service({kind:'command',target:'server',invoke(input,context){return application().admin.mutate('probe',input,context);}}),
 'admin.routing.mode.set':service({kind:'command',target:'server',invoke(input,context){return application().admin.mutate('routing',input,context);}}),
});

export {initialize} from "./composition.mjs";
