import {defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
export default defineAppServices({
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
