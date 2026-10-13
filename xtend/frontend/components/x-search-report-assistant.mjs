import {element as el} from '../dom.mjs';
// Project chrome only; RMT owns every field, selected result and action slot.
export class XSearchReportAssistant extends HTMLElement {
 static get observedAttributes(){return ['aria-label'];}
 static get xtendComponentContract(){return {schema:'xtend.component.contract.v2',tag:'x-search-report-assistant',profiles:['layout','feedback'],maturity:'ux-ready'};}
 static get xtendRmtMetadata(){return {schema:'xtend.rmt.component-contract.v1',adapter:'xtend.component',kernelBoundary:'no-rmt-kernel-import-of-xtend-types',ssr:{mode:'light-dom'},resumability:{mode:'server_prerender_resume'}};}
 static get xtendScaffoldA11yProfile(){return {schema:'xtend.a11y.screenreader-signals.v1',role:'region',accessibleName:'Ergebnisse melden',focusStrategy:'document-flow'};}
 constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.append(el('style',{},[':host{display:block}section{background:var(--panel,#fff);color:var(--ink,#111);border:1px solid var(--line,#999);box-shadow:0 8px 36px #0003;padding:0;border-radius:4px}slot{display:block}']),el('section',{part:'panel'},[el('slot',{},[]),el('slot',{name:'actions'},[])]));}
}
if(!customElements.get('x-search-report-assistant'))customElements.define('x-search-report-assistant',XSearchReportAssistant);
