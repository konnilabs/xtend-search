import {requireRole,fail} from './contracts.mjs';
export const DEFAULT_MOTD='Neugier braucht Freiraum.';
export const MOTD_TIMEZONE='Europe/Berlin';
export const motdDay=time=>new Intl.DateTimeFormat('en-CA',{timeZone:MOTD_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
export function validateMotd(input){
 const text=value=>{if(typeof value!=='string'||value.trim().length<1||[...value.trim()].length>160||/[\x00-\x1f\x7f]/.test(value))fail('validation','Bitte einen einzeiligen Text mit 1–160 Zeichen eingeben.');return value.trim();};
 if(input.operation==='list'){
  if(typeof input.messages!=='string'||input.messages.length>8192)fail('validation','Die Liste ist zu groß.');
  const messages=[...new Set(input.messages.split(/\r?\n/).filter(s=>s.trim()).map(text))];
  if(!messages.length||messages.length>50)fail('validation','Bitte 1–50 verschiedene Taglines eintragen.');return {operation:'list',messages};
 }
 if(input.operation==='override')return {operation:'override',message:text(input.message)};
 if(input.operation==='rotate')return {operation:'rotate'};
 fail('validation','Ungültige Tagesaktion.');
}
export class MotdService {
 constructor(plane,{now=Date.now}={}){this.plane=plane;this.now=now;plane.motd=this;}
 async current(){return this.plane.exclusive(async()=>{
  const day=motdDay(this.now());
  try{if(this.plane.motdState?.day!==day){
   this.plane.motdState=await this.plane.store.call('motdDay',{day});
   this.plane.telemetry.emit('content.changed',{engineId:'home.motd',policyRevision:this.plane.revision});
  }}
  catch{return {message:DEFAULT_MOTD,day,timezone:MOTD_TIMEZONE};}
  return {message:this.plane.motdState.message,day,timezone:MOTD_TIMEZONE};
 });}
 async mutate(input,context){requireRole(context,'administrator');const spec=validateMotd(input);return this.plane.mutate('motd',{revision:input.revision,requestKey:input.requestKey,reason:'initial_review',motd:spec},context);}
}
