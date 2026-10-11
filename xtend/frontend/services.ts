import {defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
import {captureSearchResource,restoreSearchResource,invalidateSearchResource,type CacheScope,type SearchCacheData,type SearchCachedResource} from './cache-service-core.mjs';
export default defineAppServices({
 'search.cache.context':service({kind:'query',target:'server'}),
 'search.cache.capture':service<{data:SearchCacheData;scope:CacheScope},boolean>({kind:'command',target:'local',invoke:input=>captureSearchResource(input)}),
 'search.cache.restore':service<{url:string;scope:CacheScope},SearchCachedResource|null>({kind:'query',target:'local',invoke:(input,context)=>restoreSearchResource(input,context)}),
 'search.cache.invalidate':service<{url?:string;scope?:CacheScope},boolean>({kind:'command',target:'local',invoke:input=>invalidateSearchResource(input)}),
 'search.run':service({kind:'stream',target:'server'}),
 'search.feedback.submit':service({kind:'command',target:'server'}),
 'search.capabilities':service({kind:'query',target:'server'})
});
