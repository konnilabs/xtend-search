import {installMotd} from './motd.mjs';
import {registerIconPack} from '@ccslabs/xtend/components/xicon.js';
import '@ccslabs/xtend/components/xspinner.js';
import {installFeedback} from './feedback.mjs';
import {installFavicons} from './favicons.mjs';
import {installAbout} from './about.mjs';
import {installPreferences} from './preferences.mjs';
import {installImagePreview} from './preview.mjs';
import {installSearchAlerts} from './alerts.mjs';
import {installResultImages} from './images.mjs';
import {installSearchStreaming} from './standalone-streaming.mjs';
import {installFilterNavigation} from './filter-navigation.mjs';
import {installSearchMotion} from './search-motion.mjs';
// Browser integration only. XTend owns navigation, history, state and all UI commits.
export function installSearchHost(){
 registerIconPack({id:'search',distribution:'local-build',cdnAllowed:false,viewBox:'0 0 24 24',strokeLinecap:'round',strokeLinejoin:'round',icons:{filter:{nodes:[{tag:'path',attrs:{d:'M3 4h18l-7 8v7l-4 2v-9z'}}]}}});
 let draft='',revision=0,submittedRevision=0,pending=false;
 const command=(name,payload={})=>window.XTendPage?.getRuntime()?.dispatchCommand(name,payload).catch(()=>{});
 installFilterNavigation(command);
 installSearchMotion();
 installAbout();installMotd();
 installFavicons();installFeedback();
 installPreferences(command);
 installImagePreview(command);
 installSearchAlerts(command);
 installResultImages(command);
 installSearchStreaming();
 let activityQueue=Promise.resolve();
 const activity=(name,payload={})=>activityQueue=activityQueue.catch(()=>{}).then(()=>command(name,payload));
 window.addEventListener('xtend-page:ready',()=>{const streaming=['pending','partial'].includes(window.XTendPage.page.props?.['search.data']?.stream?.phase);void activity('search.streaming',{busy:streaming,message:streaming?'Weitere Suchquellen werden geladen …':''});});
 document.addEventListener('input',event=>{if(event.target.id==='search-input'){draft=event.target.value;revision++;}},true);
 window.addEventListener('xtend-page:event',async({detail:event})=>{
  if(event.type==='ready'){const streaming=['pending','partial'].includes(window.XTendPage?.page?.props?.['search.data']?.stream?.phase);await activity('search.streaming',{busy:streaming,message:streaming?'Weitere Suchquellen werden geladen …':''});}
  if(event.type==='pending'){pending=true;submittedRevision=revision;await activity('search.pending');}
  if(event.type==='navigate'){
   const newerInput=pending && revision>submittedRevision;
   pending=false;
   if(newerInput){await command('search.edit',{value:draft});document.getElementById('search-input')?.focus({preventScroll:true});}
   // The results heading owns the count; this region reports loading and errors.
   const streaming=['pending','partial'].includes(event.page.props?.['search.data']?.stream?.phase);
   await activity('search.streaming',{busy:streaming,message:streaming?'Weitere Suchquellen werden geladen …':''});
  }
  if(event.type==='error'){pending=false;await activity('search.ready',{message:'Die Anfrage ist fehlgeschlagen. Bitte erneut suchen.'});}
 });
 window.addEventListener('keydown',event=>{
  if(!document.querySelector('#search-about[open],#search-feedback[open]') && event.key==='/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable){event.preventDefault();document.getElementById('search-input')?.focus();}
 });
}
