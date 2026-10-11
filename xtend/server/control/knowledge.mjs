// Reviewed engine adapters; retrieval and editorial provenance stay application-owned.
const records={
 wikipedia:{family:'wikimedia',format:'infobox',language:'native'},
 wikidata:{family:'wikimedia',format:'infobox',language:'native'},
 'ddg definitions':{family:'duckduckgo',format:'infobox',language:'english',languageNotice:'DuckDuckGo Instant Answers: überwiegend englisch; keine steuerbare Sprachfilterung.'}
};
export const knowledgeAdapter=id=>records[id]||null;
export function knowledgeLanguageMatches(engine,language){return engine.knowledgeLanguage==='english'&&(language==='all'||/^en(?:[-_].*)?$/.test(language));}
export function validKnowledgeBoxes(boxes,allowedUrl){return (Array.isArray(boxes)?boxes:[]).filter(b=>b&&typeof b.infobox==='string'&&b.infobox.trim()&&Array.isArray(b.urls)&&b.urls.some(l=>allowedUrl(l.url)));}
