import {searchUrl} from './search.mjs';
// One first-party cookie gives SSR, resumed navigation and no-JS the same defaults.
// It contains only three enumerated filter values, never queries or result URLs.
export const PREFERENCE_COOKIE='xtend_search_filters';
const choices={language:['all','de','en'],time_range:['','day','week','month','year'],safesearch:['0','1','2']};
export function validatePreferences(input){
 const values={};
 for(const [key,allowed]of Object.entries(choices)){
  const value=input instanceof URLSearchParams?input.get(key):input?.[key];
  if(!allowed.includes(value))throw new Error('Invalid filter preference');
  values[key]=value;
 }
 return values;
}
export function readPreferences(cookie=''){
 try{
  const raw=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(PREFERENCE_COOKIE+'='))?.slice(PREFERENCE_COOKIE.length+1);
  if(!raw||raw.length>512)return null;
  const data=JSON.parse(decodeURIComponent(raw));
  return data.v===1?validatePreferences(data):null;
 }catch{return null;}
}
export function preferenceCookie(values,secure=false){
 const value=values?encodeURIComponent(JSON.stringify({v:1,...validatePreferences(values)})):'';
 return `${PREFERENCE_COOKIE}=${value}; Path=/; Max-Age=${values?15552000:0}; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
}
export function withPreferences(url,cookie){
 const result=new URL(url),saved=readPreferences(cookie);
 for(const [key,value]of Object.entries(saved||{}))if(!result.searchParams.has(key))result.searchParams.set(key,value);
 return result;
}

// Home-page category links must retain explicit default/empty values too:
// otherwise a saved timeframe or language would unexpectedly reappear.
export function preferenceSearchUrl(state,patch={}){
 const current={...state,...patch},url=new URL(searchUrl(current),'http://localhost');
 if(!current.q.trim()){
  url.searchParams.set('language',current.language);
  url.searchParams.set('time_range',current.timeRange);
  url.searchParams.set('safesearch',String(current.safeSearch));
 }
 return url.pathname+url.search;
}
