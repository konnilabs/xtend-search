import {defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
import {updateDrafts} from './draft-service-core.mjs';
export default defineAppServices({
 'admin.drafts.reduce':service<Parameters<typeof updateDrafts>[0],ReturnType<typeof updateDrafts>>({kind:'command',target:'local',invoke:input=>updateDrafts(input)}),
 'admin.weather.policy.set':service({kind:'command',target:'server'}),
 'admin.motd.set':service({kind:'command',target:'server'}),
 'admin.quality.rule.set':service({kind:'command',target:'server'}),
 'admin.quality.decision':service({kind:'command',target:'server'}),
 'admin.quality.resume':service({kind:'command',target:'server'}),
 'admin.quality.evidence':service({kind:'query',target:'server'}),
 'admin.quality.simulate':service({kind:'query',target:'server'}),
 'admin.observatory.snapshot':service({kind:'query',target:'server'}),
 'admin.observatory.events':service({kind:'stream',target:'server'}),
 'admin.engine.policy.set':service({kind:'command',target:'server'}),
 'admin.engine.drain':service({kind:'command',target:'server'}),
 'admin.engine.probe.request':service({kind:'command',target:'server'}),
 'admin.routing.mode.set':service({kind:'command',target:'server'}),
});
