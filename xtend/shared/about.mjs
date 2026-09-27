// Static product copy shared by the progressive-enhancement page and XDialog.
// No search data, account details or provider content enters this markup.
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function aboutContent(locale='de',version=''){
 const en=locale==='en';
 const title=en?'About XTend.search':'Über XTend.search';
 const blocks=en?[
  ['Search with perspective','XTend.search brings results from several search providers together in one clear interface. Web results, images and knowledge cards help you explore your topic.'],
  ['Your preferences','You can save language, time range and SafeSearch under Filter. These defaults stay in a cookie in this browser for 180 days. Search terms are not stored in that cookie. You can delete the saved defaults at any time.'],
  ['Your privacy','Your query is sent to the enabled search providers. Their privacy policies apply there. XTend.search does not use analytics trackers or store query contents in the Observatory.'],
 ]:[
  ['Suche mit Perspektive','XTend.search führt Ergebnisse verschiedener Suchquellen in einer übersichtlichen Oberfläche zusammen. Webtreffer, Bilder und Wissenskarten helfen dir, dein Thema zu entdecken.'],
  ['Deine Einstellungen','Sprache, Zeitraum und SafeSearch kannst du unter Filter als Standard speichern. Diese Vorgaben bleiben 180 Tage in einem Cookie dieses Browsers erhalten – ohne Suchbegriffe. Den gespeicherten Standard kannst du jederzeit wieder löschen.'],
  ['Deine Privatsphäre','Deine Anfrage wird an freigegebene Suchquellen übermittelt. Dort gelten die Datenschutzregeln des jeweiligen Anbieters. XTend.search verwendet keine Analyse-Tracker und speichert keine Suchinhalte im Observatory.'],
 ];
 blocks.push(en?['Icons and quality reports','Result domains are sent through SearXNG to DuckDuckGo to resolve favicons, when enabled. Your browser contacts only this site. Reports store reason and source, without query, title or description. A voluntarily submitted result URL is encrypted separately for up to seven days and available only to operators and administrators. Anonymous counts remain for 30 days, action audits for 180 days. A reporting cookie lasts one day; browser and network limits are kept in memory.']:['Icons und Qualitätsmeldungen','Für Favicons übermittelt SearXNG die Ergebnisdomain an DuckDuckGo, sofern aktiviert. Dein Browser ruft nur diese Site auf. Meldungen speichern Grund und Quelle ohne Suchbegriff, Titel oder Beschreibung. Nur ausdrücklich mitgesendete Ergebnislinks liegen verschlüsselt bis zu sieben Tage in einem getrennten Belegspeicher, zugänglich für Operatoren und Administratoren. Anonyme Zählwerte bleiben 30 Tage, Aktionsprotokolle 180 Tage erhalten. Ein Melde-Cookie gilt einen Tag; Browser- und Netzwerklimits bleiben im Arbeitsspeicher.']);
 const html=`<div class="about-content">
  <div class="about-brand"><img src="/assets/xtend/mark.svg" width="48" height="48" alt=""><div><p class="about-wordmark">XTend<span>.search</span></p><p class="about-tagline">${en?'Your search. Your horizon.':'Deine Suche. Dein Horizont.'}</p></div></div>
  <div class="about-sections">${blocks.map(([heading,text])=>`<section><h2>${heading}</h2><p>${text}</p></section>`).join('')}</div>
  <div class="about-credits"><a href="https://github.com/searxng/searxng" target="_blank" rel="noopener noreferrer" data-xtend-native>Powered by SearXNG <span aria-hidden="true">↗</span></a><span>XTend.search ${escapeHtml(version)}</span></div>
  <nav class="about-links" aria-label="${en?'Project links':'Projektlinks'}"><a href="/source.tar.gz" download data-xtend-native>${en?'Download source & licenses':'Quellcode & Lizenzen herunterladen'} <span aria-hidden="true">↓</span></a></nav>
 </div>`;
 return {title,html};
}
