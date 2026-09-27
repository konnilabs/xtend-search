// Reviewed against the pinned SearXNG settings and engine endpoints. Unknown
// providers require an explicit admin choice; they must not share a global default.
const families = new Map(Object.entries({
 '360search': ['360search','360search videos'],
 bing: ['bing','bing images','bing news','bing videos'],
 duckduckgo: ['duckduckgo','duckduckgo web','duckduckgo images','duckduckgo news','duckduckgo videos','duckduckgo weather'],
 brave: ['brave','brave.images','brave.news','brave.videos'],
 'google-cse': ['google cse','google cse images'],
 wikimedia: ['wikipedia','wikidata','wikicommons.images','wikicommons.videos','wikicommons.audio','wikicommons.files'],
}).flatMap(([family,ids])=>ids.map(id=>[id,family])));
export const suggestedFamily = id => families.get(id)||'';

export function unavailableMessage(reasons){
 const unique=new Set(reasons);
 if(!unique.size)return 'Für diesen Suchmodus sind noch keine Quellen freigegeben.';
 const details=[];
 if(unique.has('safesearch'))details.push('Die freigegebenen Quellen unterstützen den gewählten SafeSearch-Filter nicht.');
 if(unique.has('language'))details.push('Die gewählte Sprache wird von den freigegebenen Quellen nicht unterstützt.');
 if(unique.has('time_range'))details.push('Die freigegebenen Quellen unterstützen den gewählten Zeitraum nicht.');
 if(unique.has('paging'))details.push('Für diese Quellen ist die Seitennavigation nicht freigegeben.');
 if(['provider_family_cooldown','cooldown','watch_required','quarantine','drained'].some(r=>unique.has(r)))details.push('Suchquellen sind durch Schutzfristen oder eine Betriebspause gesperrt.');
 if(unique.has('budget'))details.push('Das verfügbare Suchbudget ist derzeit ausgeschöpft. Bitte später erneut versuchen.');
 if(unique.has('capability_changed'))details.push('Die Fähigkeiten der Quellen haben sich geändert und müssen erneut geprüft werden.');
 if(unique.has('backend_unavailable')||unique.has('storage_unavailable'))details.push('Der Suchdienst ist vorübergehend nicht verfügbar.');
 return details.join(' ')||'Für diese Suche sind derzeit keine passenden Quellen verfügbar.';
}
