import {installCategoryTabs} from './category-tabs.mjs';
import {installWeatherUnitActivation} from './weather-units.mjs';
import {installFilterMotion} from './filter-motion.mjs';
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
 registerIconPack({id:'search',distribution:'local-build',cdnAllowed:false,viewBox:'0 0 24 24',strokeLinecap:'round',strokeLinejoin:'round',icons:{
  filter:{nodes:[{tag:'path',attrs:{d:'M3 4h18l-7 8v7l-4 2v-9z'}}]},
  temperature:{nodes:[{tag:'path',attrs:{d:'M12 14.5V5a3 3 0 0 0-6 0v9.5a5 5 0 1 0 6 0z M9 8v9'}}]},
  'temperature-low':{nodes:[{tag:'path',attrs:{d:'M12 14.5V5a3 3 0 0 0-6 0v9.5a5 5 0 1 0 6 0z M9 8v9 M19 4v9m-3-3 3 3 3-3'}}]},
  'temperature-high':{nodes:[{tag:'path',attrs:{d:'M12 14.5V5a3 3 0 0 0-6 0v9.5a5 5 0 1 0 6 0z M9 8v9 M19 13V4m-3 3 3-3 3 3'}}]},
  'rain-probability':{nodes:[{tag:'path',attrs:{d:'M12 3c-2.5 3-6 7-6 11a6 6 0 0 0 12 0c0-4-3.5-8-6-11z'}}]}
 }});
 let draft='',revision=0,submittedRevision=0,pending=false;
 const command=(name,payload={})=>window.XTendPage?.getRuntime()?.dispatchCommand(name,payload).catch(()=>{});
 installFeedback();
 installFilterNavigation(command);
 installFilterMotion(command);
 const motion=installSearchMotion();
 installCategoryTabs();
 installWeatherUnitActivation();
 installAbout();installMotd();
 installFavicons();
 installPreferences(command);
 installImagePreview(command);
 installSearchAlerts(command);
 installResultImages(command);
 installSearchStreaming();
 const visibility=()=>void command('search.weather.visible',{visible:!document.hidden});document.addEventListener('visibilitychange',visibility);window.addEventListener('xtend-page:ready',visibility);
 let activityQueue=Promise.resolve(),presentationGeneration=0;
 const activity=(name,payload={},own=presentationGeneration)=>activityQueue=activityQueue.catch(()=>{}).then(()=>own===presentationGeneration?command(name,payload):undefined);
 window.addEventListener('xtend-page:ready',()=>{const streaming=['pending','partial'].includes(window.XTendPage.page.props?.['search.data']?.stream?.phase);void activity('search.streaming',{busy:streaming,message:''});});
 document.addEventListener('input',event=>{if(event.target.id==='search-input'){draft=event.target.value;revision++;const locationField=document.getElementById('search-form')?.elements.namedItem('location');if(locationField)locationField.value='';}},true);
 window.addEventListener('xtend-page:event',async({detail:event})=>{
  if(event.type==='ready'){const streaming=['pending','partial'].includes(window.XTendPage?.page?.props?.['search.data']?.stream?.phase);await activity('search.streaming',{busy:streaming,message:''});}
  if(event.type==='pending'){
   const own=++presentationGeneration;pending=true;submittedRevision=revision;
   const target=new URL(event.url,location.origin);
   // Commit only presentation immediately; PageClient still owns data/history.
   // Slow page/asset responses must not postpone the intentional header move.
   await activity('search.pending',{view:target.searchParams.get('q')?.trim()?'results':'home'},own);
   if(own===presentationGeneration)motion.commit();
  }
  if(event.type==='navigate'){
   const newerInput=pending && revision>submittedRevision;
   pending=false;
   if(newerInput){await command('search.edit',{value:draft});document.getElementById('search-input')?.focus({preventScroll:true});}
   // The results heading owns the count; this region reports loading and errors.
   const streaming=['pending','partial'].includes(event.page.props?.['search.data']?.stream?.phase);
   await activity('search.streaming',{busy:streaming,message:''});
   motion.commit();
  }
  if(event.type==='error'){pending=false;await activity('search.ready',{message:'Die Anfrage ist fehlgeschlagen. Bitte erneut suchen.'});motion.commit();}
 });
 window.addEventListener('keydown',event=>{
  if(!document.querySelector('#search-about[open],#report-discard-dialog[open]') && event.key==='/' && !event.ctrlKey && !event.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable){event.preventDefault();document.getElementById('search-input')?.focus();}
 });
}
