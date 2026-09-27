const normalize=value=>String(value).replaceAll('_','-').toLowerCase();
export const matchesLanguage=(locale,language)=>normalize(locale)===normalize(language)||normalize(locale).startsWith(normalize(language)+'-');

// SearXNG sets language_support from languages OR regions. In particular,
// Bing resolves a language such as "de" through its advertised de-DE market.
// Keep existing language records stable; add only region coverage not already
// represented by a language. An empty catalog never means "all languages".
export function catalogLanguages(languages,regions){
 const result=Array.isArray(languages)?languages.filter(x=>typeof x==='string').slice(0,300):[];
 for(const value of Array.isArray(regions)?regions.slice(0,300):[]){
  if(typeof value!=='string')continue;
  let locale;try{locale=Intl.getCanonicalLocales(value.replaceAll('_','-'))[0];}catch{continue;}
  if(locale&&!result.some(language=>matchesLanguage(locale,language)))result.push(locale);
 }
 return result;
}

// Explicit maintenance review only, never called by discovery or eligibility.
// Refuse to re-approve any other changed backend metadata or new source.
export function localeCatalogRepair(state,catalog){
 const changes=[];
 for(const row of state.policies){
  const p=JSON.parse(row.value),e=catalog.get(row.id);
  if(p.state!=='allowed'||!e||p.fingerprint===e.fingerprint)continue;
  if(!p.fingerprint||p.fingerprint!==e.legacyLocaleFingerprint)throw new Error('Weitere Capability-Änderung bei '+row.id+': manuelle Prüfung erforderlich.');
  changes.push({id:row.id,languages:e.languages});
 }
 return {revision:state.meta.revision,changes};
}
