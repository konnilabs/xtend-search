import {defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
import {captureSearchResource,restoreSearchResource,invalidateSearchResource,type CacheScope,type SearchCacheData,type SearchCachedResource} from './cache-service-core.mjs';
import {aboutModel,overlayState,carouselModel,carouselMove,carouselFailure} from './overlay-service-core.mjs';
import {faviconResources} from './favicon-service-core.mjs';
import {reduceReport,selectReport,submitReport} from './report-service-core.mjs';
import {consumeSearchStream,consumeRemoteStream} from './stream-service-core.mjs';
import {savePreferences} from './preferences-service-core.mjs';
import {applyResultProjection,readActionSearchData} from './result-projection-core.mjs';
export default defineAppServices({
 'search.images.apply':service<Parameters<typeof applyResultProjection>[0],ReturnType<typeof applyResultProjection>>({kind:'command',target:'local',invoke:(input,context)=>applyResultProjection(input,readActionSearchData(context))}),
 'search.remote.present':service<Parameters<typeof consumeRemoteStream>[0],boolean>({kind:'command',target:'local',concurrency:'latest',invoke:(input,context)=>consumeRemoteStream(input,context as Parameters<typeof consumeRemoteStream>[1])}),
 'search.preferences.save':service<Parameters<typeof savePreferences>[0],Awaited<ReturnType<typeof savePreferences>>>({kind:'command',target:'local',invoke:(input,context)=>savePreferences(input,context)}),
 'search.stream.consume':service<Parameters<typeof consumeSearchStream>[0],boolean>({kind:'command',target:'local',concurrency:'latest',invoke:(input,context)=>consumeSearchStream(input,context as Parameters<typeof consumeSearchStream>[1])}),
 'search.report.reduce':service<Parameters<typeof reduceReport>[0],ReturnType<typeof reduceReport>>({kind:'command',target:'local',invoke:input=>reduceReport(input)}),
 'search.report.select':service<Parameters<typeof selectReport>[0],ReturnType<typeof selectReport>>({kind:'command',target:'local',invoke:input=>selectReport(input)}),
 'search.report.submit':service<Parameters<typeof submitReport>[0],Awaited<ReturnType<typeof submitReport>>>({kind:'command',target:'local',invoke:(input,context)=>submitReport(input,context)}),
 'search.favicons.ready':service<{src:string;url:string},boolean>({kind:'command',target:'local',invoke:({src,url})=>faviconResources.markReady(src,url)}),
 'search.favicons.load':service<{src:string},string|null>({kind:'query',target:'local',concurrency:'parallel',invoke:(input,{signal})=>faviconResources.load(input.src,signal)}),
 'search.favicons.project':service({kind:'query',target:'local',invoke:({results})=>({results:faviconResources.decorate(results)})}),
 'search.about.content':service({kind:'query',target:'local',invoke:()=>aboutModel()}),
 'search.overlay.reduce':service({kind:'command',target:'local',invoke:({current,patch})=>overlayState(current,patch)}),
 'search.media.select':service<Parameters<typeof carouselModel>[0],ReturnType<typeof carouselModel>>({kind:'query',target:'local',invoke:input=>carouselModel(input)}),
 'search.media.move':service<Parameters<typeof carouselMove>[0],ReturnType<typeof carouselMove>>({kind:'query',target:'local',invoke:input=>carouselMove(input)}),
 'search.media.failure':service({kind:'command',target:'local',invoke:input=>carouselFailure(input)}),
 'search.weather.run':service({kind:'stream',target:'server'}),
 'search.weather.cache.context':service({kind:'query',target:'server'}),
 'search.feedback.batch.submit':service({kind:'command',target:'server'}),
 'search.motd':service({kind:'query',target:'server'}),
 'search.cache.context':service({kind:'query',target:'server'}),
 'search.cache.capture':service<{data:SearchCacheData;scope:CacheScope},boolean>({kind:'command',target:'local',invoke:input=>captureSearchResource(input)}),
 'search.cache.restore':service<{url:string;scope:CacheScope},SearchCachedResource|null>({kind:'query',target:'local',invoke:(input,context)=>restoreSearchResource(input,context)}),
 'search.cache.invalidate':service<{url?:string;scope?:CacheScope},boolean>({kind:'command',target:'local',invoke:input=>invalidateSearchResource(input)}),
 'search.run':service({kind:'stream',target:'server'}),
 'search.feedback.submit':service({kind:'command',target:'server'}),
 'search.capabilities':service({kind:'query',target:'server'})
});
