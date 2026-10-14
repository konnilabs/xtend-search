import {defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
import {updateDrafts,feedbackModel,saveAdminForm,resolveAdminGuard} from './draft-service-core.mjs';
import {observeAdmin,evidenceModel} from './live-service-core.mjs';
export default defineAppServices({
 'admin.live.observe':service<Record<string,never>,void>({kind:'command',target:'local',concurrency:'latest',invoke:(input,context)=>observeAdmin(input,context as Parameters<typeof observeAdmin>[1])}),
 'admin.evidence.project':service<{rows:Parameters<typeof evidenceModel>[0]},ReturnType<typeof evidenceModel>>({kind:'query',target:'local',invoke:({rows})=>evidenceModel(rows)}),
 'admin.feedback.reduce':service<Parameters<typeof feedbackModel>[0],ReturnType<typeof feedbackModel>>({kind:'command',target:'local',invoke:input=>feedbackModel(input)}),
 'admin.form.save':service<Parameters<typeof saveAdminForm>[0],boolean>({kind:'command',target:'local',invoke:(input,context)=>saveAdminForm(input,context as Parameters<typeof saveAdminForm>[1])}),
 'admin.guard.resolve':service<Parameters<typeof resolveAdminGuard>[0],boolean>({kind:'command',target:'local',concurrency:'parallel',invoke:(input,context)=>resolveAdminGuard(input,context as Parameters<typeof resolveAdminGuard>[1])}),
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
