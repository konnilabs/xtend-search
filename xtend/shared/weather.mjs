import {searchIdentity} from './cache-identity.mjs';
export const WEATHER_BUDGETS={minute:540,hour:4500,day:9000,month:270000};
const groups={sun:[0],clear:[1],partly:[2],cloud:[3],fog:[45,48],drizzle:[51,53,55],freezing:[56,57,66,67],rain:[61,63,65,80,81,82],snow:[71,73,75,77,85,86],storm:[95,96,97,99]};
const labels={sun:'Klar',clear:'Überwiegend klar',partly:'Teilweise bewölkt',cloud:'Bedeckt',fog:'Nebel',drizzle:'Nieselregen',freezing:'Gefrierender Niederschlag',rain:'Regen',snow:'Schnee',storm:'Gewitter',unknown:'Wetterzustand nicht verfügbar'};
export function weatherCondition(code,isDay=1){const kind=Object.keys(groups).find(k=>typeof code==='number'&&groups[k].includes(code))||'unknown';return {kind,label:labels[kind],icon:'/assets/xtend/weather/'+(isDay===0&&['sun','clear'].includes(kind)?'moon':isDay===0&&kind==='partly'?'partly-night':kind)+'.svg'};}
export function weatherIdentity(state){return searchIdentity({...state,category:'weather',page:1,continuation:''});}
