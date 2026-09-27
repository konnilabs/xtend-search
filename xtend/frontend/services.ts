import {defineAppServices,service} from '@ccslabs/xtend/maraca/app-services';
export default defineAppServices({
 'search.run':service({kind:'stream',target:'server'}),
 'search.feedback.submit':service({kind:'command',target:'server'}),
 'search.capabilities':service({kind:'query',target:'server'})
});
