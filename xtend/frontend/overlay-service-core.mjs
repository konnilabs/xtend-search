import {aboutContent} from '../shared/about.mjs';
import {VERSION} from '../shared/version.mjs';
import {IMAGE_PLACEHOLDER} from './images.mjs';
export function aboutModel(){const {blocks,version}=aboutContent('de',VERSION);return {versionLabel:`XTend.search ${version}`,blocks:blocks.map(([heading,text],id)=>({id:String(id),heading,text}))};}
export function overlayState(current,patch){const next={...current,...patch};return {...next,active:!!(next.about||next.lightbox)};}
export function carouselModel({items,id,key}){
 const entries=items.filter(item=>item.previewId&&/^\/(media|image_proxy)\?/.test(item.previewSrc||''));
 const index=entries.findIndex(item=>item.id===id);if(index<0)return null;
 const item=entries[index];return {id:item.id,title:item.title,src:item.previewSrc,thumbnail:item.thumbnail,url:item.url,imageUrl:item.imageUrl||'',key,position:`Bild ${index+1} von ${entries.length}`,stepsDisabled:entries.length<2,loading:true,imageError:false,message:'Bild wird geladen …',fallbackUsed:false};
}
export function carouselMove({items,id,delta}){const entries=items.filter(item=>item.previewId&&/^\/(media|image_proxy)\?/.test(item.previewSrc||''));const index=entries.findIndex(item=>item.id===id);if(index<0||!entries.length)return '';return entries[(index+delta+entries.length)%entries.length].id;}
export function carouselFailure(media){if(!media.fallbackUsed&&media.thumbnail&&media.thumbnail!==media.src)return {...media,src:media.thumbnail,key:media.key+':fallback',fallbackUsed:true,loading:true,imageError:false};return {...media,src:IMAGE_PLACEHOLDER,key:media.key+':unavailable',loading:false,imageError:true,message:'Dieses Bild ist nicht erreichbar. Du kannst weiterblättern oder die Quelle öffnen.',fallbackUsed:true};}
