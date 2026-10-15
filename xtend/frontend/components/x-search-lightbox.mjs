// Project fork of XTend 0.9 XLightbox (Apache-2.0; LICENSE-XTend).
// Preserve the viewport/media contract and CSS parts. RMT owns open state,
// images and controls; this boundary owns only its private, static native shell.
import {componentNode,createComponentStyle} from '@ccslabs/xtend/components/component-dom.js';
import {LIGHTBOX_STYLES} from './x-search-lightbox-styles.mjs';
import {focusElement} from '../browser-capabilities.mjs';
export class XSearchLightbox extends HTMLElement {
 static get observedAttributes(){return ['open'];}
 static get xtendComponentContract(){return {schema:'xtend.component.contract.v2',tag:'x-search-lightbox',profiles:['overlay','media'],maturity:'ux-ready'};}
 static get xtendRmtMetadata(){return {schema:'xtend.rmt.component-contract.v1',adapter:'xtend.component',schedule:'media.lazy.load',kernelBoundary:'no-rmt-kernel-import-of-xtend-types'};}
 static get xtendScaffoldA11yProfile(){return {schema:'xtend.a11y.screenreader-signals.v1',role:'dialog',accessibleName:'Bildansicht',focusStrategy:'close-button-return-focus'};}
 static get xtendScaffoldPerformanceProfile(){return {schema:'xtend.performance.component-profile.v1',performanceProfile:'media',budgetClass:'media-overlay',lane:'media',hydrationPolicy:'lazy',criticalMeasurements:['xtend.lightbox.open'],idleOrBackgroundAllowed:true};}
 constructor(){
  super();const doc=this.ownerDocument,node=(tag,attrs={},children=[])=>componentNode(doc,tag,attrs,children);
  this._dialog=node('dialog',{part:'overlay root',class:'overlay',role:'dialog','aria-modal':'true','aria-label':'Bildansicht',tabindex:'-1'},[
   node('slot',{name:'close',part:'close control'}),node('div',{part:'content',class:'content'},[node('slot',{name:'media',part:'media'})]),node('slot',{name:'controls',part:'controls'})
  ]);
  this.attachShadow({mode:'open'}).append(createComponentStyle(LIGHTBOX_STYLES,doc),this._dialog);
  this._dialog.addEventListener('cancel',event=>{event.preventDefault();this.requestClose('escape');});
  this._dialog.addEventListener('keydown',event=>{
   if(event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey)return;
   const controls=[...this.querySelectorAll('button:not([disabled]),a[href]')].filter(control=>control.getClientRects().length),active=doc.activeElement;
   if(!controls.length){event.preventDefault();focusElement(this._dialog,{preventScroll:true});}
   else if(event.shiftKey&&(active===controls[0]||!controls.includes(active))){event.preventDefault();focusElement(controls.at(-1));}
   else if(!event.shiftKey&&(active===controls.at(-1)||!controls.includes(active))){event.preventDefault();focusElement(controls[0]);}
  });
 }
 connectedCallback(){queueMicrotask(()=>this.syncOpen());}
 disconnectedCallback(){if(this._dialog.open)this._dialog.close();}
 attributeChangedCallback(){if(this.isConnected)queueMicrotask(()=>this.syncOpen());}
 syncOpen(){
  if(!this.isConnected)return;
  if(this.hasAttribute('open')&&!this._dialog.open){this._dialog.showModal();this.dispatchEvent(new CustomEvent('lightbox-opened',{bubbles:true,composed:true}));}
  else if(!this.hasAttribute('open')&&this._dialog.open)this._dialog.close();
 }
 requestClose(source){this.dispatchEvent(new CustomEvent('lightbox-close-request',{detail:{source},bubbles:true,composed:true}));}
 snapshot(){return {schema:'xtend.component.layout-display-media-snapshot.v1',componentRef:'x-search-lightbox',open:this.hasAttribute('open'),schedule:'media.lazy.load'};}
}
if(!customElements.get('x-search-lightbox'))customElements.define('x-search-lightbox',XSearchLightbox);
