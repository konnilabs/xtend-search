import {AppServiceError} from '@ccslabs/xtend/maraca/app-services';
export const MODES = ['general','images','news','videos','music','it','science','files','social media'];
export const LABELS = {general:'Web',images:'Bilder',news:'Nachrichten',videos:'Videos',music:'Musik',it:'IT',science:'Wissenschaft',files:'Dateien','social media':'Soziale Medien'};
export const REASONS = ['initial_review','maintenance','provider_limit','technical_failure','schema_invalid','wrong_result_type','unsafe_url_scheme','audience_mismatch','insufficient_editorial_quality','recovery_review'];
export function fail(code,message='Die Aktion konnte nicht ausgeführt werden.') { throw new AppServiceError(message,{code:`xsearch.${code}`,expose:true}); }
export function integer(value,min,max,name='Wert') { const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)fail('validation',`${name}: ${min} bis ${max} erforderlich.`);return n; }
export function enumValue(value,values){if(!values.includes(value))fail('validation','Ungültige Auswahl.');return value;}
export function key(value){if(typeof value!=='string'||!value||value.length>100||/[\x00-\x1f\x7f,]/u.test(value))fail('validation','Ungültige Quellenkennung.');return value;}
export function plain(value,max=1600){return typeof value==='string'?value.replace(/<[^>]*>/gu,'').replace(/&(?:amp|lt|gt|quot|#39);/gu,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[s])).slice(0,max):'';}
export function validateQuery(q){
 if(typeof q!=='string'||!q.trim()||q.length>2048||/[\x00-\x1f\x7f-\x9f]/u.test(q))fail('query','Bitte einen gültigen Suchbegriff eingeben.');
 // Reviewed against RawTextQuery.PARSER_CLASSES at the pinned SearXNG commit.
 // A conservative lexical boundary covers every special-parser prefix, even
 // currently unknown bangs. Python's additional whitespace controls are rejected above.
 for(const token of q.split(/\s+/u))if(['!',':','<'].includes(token[0]))fail('query','Suchquellen, Sprache und Zeitlimit werden über die Oberfläche gewählt. !-Befehle sind hier deaktiviert.');
 return q;
}
export const now=()=>Date.now();
export function retryAfter(value,time=Date.now()){if(!value)return null;const n=Number(value);const t=Number.isFinite(n)?time+Math.max(0,n)*1000:Date.parse(value);return Number.isFinite(t)?Math.max(time,t):null;}
export function allowedUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u:null;}catch{return null;}}
export function requireRole(context,minimum){const roles={viewer:1,operator:2,administrator:3};if(!context.actor||!(roles[context.role]>=roles[minimum]))fail('forbidden','Für diese Aktion fehlt die Berechtigung.');}
