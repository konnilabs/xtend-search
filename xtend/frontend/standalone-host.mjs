import {installFeedback} from './feedback.mjs';
import {installFavicons} from './favicons.mjs';
import {installAbout} from './about.mjs';
import {installPreferences} from './preferences.mjs';
import {installImagePreview} from './preview.mjs';
import {installSearchAlerts} from './alerts.mjs';
import {installResultImages} from './images.mjs';
import {installSearchStreaming} from './standalone-streaming.mjs';
// Browser integration only. XTend owns navigation, history, state and all UI commits.
export function installSearchHost(){
 let draft='',revision=0,submittedRevision=0,pending=false;
 const command=(name,payload={})=>window.XTendPage?.getRuntime()?.dispatchCommand(name,payload).catch(()=>{});
 installAbout();
 installFavicons();installFeedback();
 installPreferences(command);
 installImagePreview(command);
 installSearchAlerts(command);
 installResultImages(command);
 installSearchStreaming();
 document.addEventListener('input',event=>{if(event.target.id==='search-input'){draft=event.target.value;revision++;}},true);
 window.addEventListener('xtend-page:event',async({detail:event})=>{
  if(event.type==='pending'){pending=true;submittedRevision=revision;await command('search.pending');}
  if(event.type==='navigate'){
   const newerInput=pending && revision>submittedRevision;
   pending=false;
   if(newerInput){await command('search.edit',{value:draft});document.getElementById('search-input')?.focus({preventScroll:true});}
   // The results heading owns the count; this region reports loading and errors.
   const streaming=['pending','partial'].includes(event.page.props?.['search.data']?.stream?.phase);
   await command('search.streaming',{busy:streaming,message:streaming?'Weitere Suchquellen werden geladen …':''});
  }
  if(event.type==='error'){pending=false;await command('search.ready',{message:'Die Anfrage ist fehlgeschlagen. Bitte erneut suchen.'});}
 });
 window.addEventListener('keydown',event=>{
  if(!document.querySelector('#search-about[open],#search-feedback[open]') && event.key==='/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable){event.preventDefault();document.getElementById('search-input')?.focus();}
 });
}
