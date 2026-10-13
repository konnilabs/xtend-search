import {LIGHTBOX_STYLES} from './x-search-lightbox-styles.mjs';
// Project-specific fork of XTend 0.9.0 XLightbox (Apache-2.0).
// SDK source SHA-256: b1af376c5c2d6b420887cf2caa87fa2af2b3e92eef6fc3b0d292ea1de1e50c29.
// Explicit controls slot, safe static DOM, carousel lifecycle; no SDK rewriting.
import {xtendState} from '@ccslabs/xtend/components/xtend-state.js';
import {element as el} from '../dom.mjs';
import {attachSearchCarousel} from '../search-lightbox-controller.mjs';

export class XSearchLightbox extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'open', 'alt'];
  }

  static get xtendComponentContract() {
    return {
      schema: 'xtend.component.contract.v2',
      tag: 'x-search-lightbox',
      profiles: ['overlay', 'media'],
      maturity: 'ux-ready'
    };
  }

  static get xtendRmtMetadata() {
    return {
      schema: 'xtend.rmt.component-contract.v1',
      adapter: 'xtend.component',
      schedule: 'media.lazy.load',
      kernelBoundary: 'no-rmt-kernel-import-of-xtend-types'
    };
  }

  static get xtendScaffoldA11yProfile() {
    return {
      schema: 'xtend.a11y.screenreader-signals.v1',
      role: 'dialog',
      accessibleName: 'Lightbox',
      focusStrategy: 'close-button-return-focus'
    };
  }

  static get xtendScaffoldPerformanceProfile() {
    return {
      schema: 'xtend.performance.component-profile.v1',
      performanceProfile: 'media',
      budgetClass: 'media-overlay',
      lane: 'media',
      hydrationPolicy: 'lazy',
      criticalMeasurements: ['xtend.media.lazyLoad', 'xtend.lightbox.open'],
      idleOrBackgroundAllowed: true
    };
  }

  static get xtendLayoutDisplayMediaUxProfile() {
    return {
      schema: 'xtend.component.layout-display-media-ux-profile.v1',
      componentRef: 'x-search-lightbox',
      family: 'media-lightbox',
      role: 'dialog',
      contentKind: 'image-preview-overlay',
      responsiveStrategy: 'viewport-bounded-media',
      lazyPolicy: 'lazy-media-load',
      overflowPolicy: 'viewport-overlay-contained',
      aspectRatio: 'media-contain',
      events: ['lightbox-opened', 'lightbox-closed'],
      commands: ['lazy-load', 'expand', 'collapse', 'snapshot'],
      stateKey: 'xlightbox-open-<id>',
      schedule: 'media.lazy.load',
      fabric: { lane: 'media', a11yLane: 'a11y', diagnosticsLane: 'diagnostics', api: '@xtend-fabric' },
      rmt: { adapter: 'xtend.component', kernelBoundary: 'no-rmt-kernel-import-of-xtend-types' }
    };
  }

  constructor() {
    super();
    this._open = false;
    this._src = '';
    this._closeTimer = null;
    this._unsubscribeState = null;
    this._previouslyFocusedElement = null;
    this._synchronizingAttribute = false;
    this._portalParent = null;
    this._portalNextSibling = null;
    this._isPortaled = false;
    this._isMovingPortal = false;
    this._onDocumentKeyDown = this._handleKeyDown.bind(this);

    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(el("style",{},[LIGHTBOX_STYLES]),el("span",{"class": "trigger", "part": "trigger"},[el("slot",{"name": "trigger"},[])]),el("div",{"class": "overlay", "part": "overlay root", "role": "dialog", "aria-modal": "true", "aria-hidden": "true", "aria-label": "Lightbox", "hidden": true, "inert": true},[el("div",{"class": "content", "part": "content"},[el("button",{"class": "close-btn", "part": "close control", "type": "button", "aria-label": "Schliessen"},[el("svg",{"part": "close-icon control icon", "viewBox": "0 0 24 24", "fill": "none", "aria-hidden": "true", "focusable": "false", "xmlns": "http://www.w3.org/2000/svg"},[el("path",{"d": "M7.75 7.75L16.25 16.25M16.25 7.75L7.75 16.25", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke"},[])])]),el("img",{"part": "media", "src": "", "alt": ""},[]),el("slot",{"name": "controls"},[])])]));

    this._trigger = this.shadowRoot.querySelector('.trigger');
    this._triggerSlot = this.shadowRoot.querySelector('slot[name="trigger"]');
    this._overlay = this.shadowRoot.querySelector('.overlay');
    this._content = this.shadowRoot.querySelector('.content');
    this._img = this.shadowRoot.querySelector('img');
    this._btn = this.shadowRoot.querySelector('.close-btn');

    this._trigger.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      this.open();
    });
    this._trigger.addEventListener('button-interaction', (event) => {
      if (event.defaultPrevented) return;
      this.open();
    });
    this._btn.addEventListener('click', () => this.close({ source: 'button' }));
    this._overlay.addEventListener('click', (event) => {
      if (event.target === this._overlay) this.close({ source: 'overlay' });
    });
  }

  configureSearch({onSelect}) { this.onSearchSelect=onSelect; }
  openCarousel(items,id) { return this.carousel?.open(items,id) || false; }
  closeCarousel(options) { this.carousel?.close(options); }
  isCarouselOpen() { return this.carousel?.isOpen() || false; }
  updateCarousel(items) { this.carousel?.updateEntries(items); }

  connectedCallback() {
    if(!this.carousel)this.carousel=attachSearchCarousel(this,{onSelect:id=>this.onSearchSelect?.(id)});
    if (this._isMovingPortal) return;
    if (!this.id) this.id = `xlightbox-${Math.random().toString(36).slice(2, 10)}`;

    this._src = this.getAttribute('src') || this._src || '';
    this._syncMedia();
    this._syncA11y();
    document.addEventListener('keydown', this._onDocumentKeyDown);

    if (typeof xtendState.subscribe === 'function') {
      this._unsubscribeState = xtendState.subscribe((key, value) => {
        if (key !== `xlightbox-open-${this.id}`) return;
        if (value && typeof value === 'object' && value.open && value.src) {
          this.open(value.src, { source: 'xtend-state' });
        } else if (value === false) {
          this.close({ source: 'xtend-state', immediate: true });
        }
      }, `xlightbox-open-${this.id}`);
    }

    if (this.hasAttribute('open')) {
      this.open(this._src, { source: 'attribute', silent: true });
    } else {
      this._publishState(false);
    }
  }

  disconnectedCallback() {
    if(!this._isMovingPortal){this.carousel?.dispose();this.carousel=null;}
    if (this._isMovingPortal) return;
    document.removeEventListener('keydown', this._onDocumentKeyDown);
    if (typeof this._unsubscribeState === 'function') {
      this._unsubscribeState();
      this._unsubscribeState = null;
    }
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
    this._clearPortalState();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'src') {
      this._src = newValue || '';
      this._syncMedia();
      return;
    }

    if (name === 'alt') {
      this._syncMedia();
      return;
    }

    if (name === 'open' && !this._synchronizingAttribute && this.isConnected) {
      newValue === null ? this.close({ source: 'attribute' }) : this.open(this._src, { source: 'attribute' });
    }
  }

  open(src = this._src || this.getAttribute('src'), options = {}) {
    const resolvedSrc = this._resolveSrc(src);
    if (!resolvedSrc) return false;

    const wasOpen = this._open;
    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }

    this._src = resolvedSrc;
    this._previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this._ensureDocumentPortal();
    this._open = true;
    this._syncOpenAttribute(true);
    this._syncMedia();
    this._syncA11y();
    this._content.classList.remove('closing');

    if (!wasOpen && !options.silent) {
      this.dispatchEvent(new CustomEvent('lightbox-opened', {
        detail: { src: resolvedSrc },
        bubbles: true,
        composed: true
      }));
    }

    if (options.source !== 'xtend-state') {
      this._publishState(true);
    }

    queueMicrotask(() => this._focusElement(this._btn));
    return true;
  }

  close(options = {}) {
    if (!this._open && !this.hasAttribute('open')) return false;
    const source = options.source || 'api';
    const complete = () => this._completeClose(source, options);

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }

    if (options.immediate) {
      complete();
      return true;
    }

    this._content.classList.add('closing');
    this._closeTimer = setTimeout(complete, 160);
    return true;
  }

  snapshot() {
    return {
      schema: 'xtend.component.layout-display-media-snapshot.v1',
      componentRef: 'x-search-lightbox',
      stateKey: `xlightbox-open-${this.id}`,
      schedule: 'media.lazy.load',
      src: this._src || this.getAttribute('src') || '',
      open: this._open
    };
  }

  _completeClose(source, options = {}) {
    this._closeTimer = null;
    const closedSrc = this._src;
    this._content.classList.remove('closing');
    this._restoreFocus();
    this._open = false;
    this._syncOpenAttribute(false);
    this._syncA11y();
    this._img.removeAttribute('src');

    if (source !== 'xtend-state') {
      this._publishState(false);
    }

    if (!options.silent) {
      this.dispatchEvent(new CustomEvent('lightbox-closed', {
        detail: { src: closedSrc },
        bubbles: true,
        composed: true
      }));
    }

    this._restoreDocumentPortal();
  }

  _handleKeyDown(event) {
    if (event.key === 'Escape' && this._open) {
      this.close({ source: 'escape' });
    }
  }

  _resolveSrc(src) {
    return typeof src === 'string' && src.trim() ? src.trim() : '';
  }

  _syncOpenAttribute(isOpen) {
    this._synchronizingAttribute = true;
    this.toggleAttribute('open', isOpen);
    this._synchronizingAttribute = false;
  }

  _syncMedia() {
    if (!this._img) return;
    const src = this._src || this.getAttribute('src') || '';
    if (this._open && src) {
      this._img.src = src;
    }
    this._img.alt = this.getAttribute('alt') || '';
  }

  _syncA11y() {
    if (!this._overlay) return;
    this._overlay.hidden = !this._open;
    this._overlay.toggleAttribute('inert', !this._open);
    this._overlay.inert = !this._open;
    this._overlay.setAttribute('aria-hidden', this._open ? 'false' : 'true');
    this._syncTriggerA11y();
  }

  _syncTriggerA11y() {
    if (!this._triggerSlot) return;
    this._triggerSlot.assignedElements({ flatten: true }).forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.setAttribute('aria-expanded', this._open ? 'true' : 'false');
      element.setAttribute('aria-controls', `${this.id}-overlay`);
    });
    this._overlay.id = `${this.id}-overlay`;
  }

  _restoreFocus() {
    const focusTarget = this._resolveFocusReturnTarget();
    if (!focusTarget) return;
    this._focusElement(focusTarget);
  }

  _focusElement(element) {
    if (!element || typeof element.focus !== 'function') return;
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  _resolveFocusReturnTarget() {
    if (
      this._previouslyFocusedElement &&
      this._previouslyFocusedElement.isConnected &&
      typeof this._previouslyFocusedElement.focus === 'function' &&
      !this._overlay.contains(this._previouslyFocusedElement)
    ) {
      return this._previouslyFocusedElement;
    }
    const triggerCandidate = this._triggerSlot
      ? this._triggerSlot.assignedElements({ flatten: true }).find((element) => element instanceof HTMLElement && typeof element.focus === 'function')
      : null;
    if (triggerCandidate && triggerCandidate.isConnected) {
      return triggerCandidate;
    }
    return document.body instanceof HTMLElement ? document.body : null;
  }

  _publishState(isOpen) {
    if (!this.id || typeof xtendState.set !== 'function') return;
    xtendState.set(`xlightbox-open-${this.id}`, isOpen ? { open: true, src: this._src } : false);
  }

  _ensureDocumentPortal() {
    if (this._isPortaled || !this.isConnected || !document.body || this.parentNode === document.body) {
      return;
    }

    this._portalParent = this.parentNode;
    this._portalNextSibling = this.nextSibling;
    this._isMovingPortal = true;
    document.body.appendChild(this);
    this._isMovingPortal = false;
    this._isPortaled = true;
    this.setAttribute('data-xtend-portal', 'document-body');
  }

  _restoreDocumentPortal() {
    if (!this._isPortaled) return;

    const parent = this._portalParent;
    const nextSibling = this._portalNextSibling;
    this._isMovingPortal = true;

    if (parent && parent.isConnected) {
      parent.insertBefore(this, nextSibling && nextSibling.parentNode === parent ? nextSibling : null);
    } else if (this.parentNode) {
      this._isMovingPortal = false;
      this.remove();
      this._clearPortalState();
      return;
    }

    this._isMovingPortal = false;
    this._clearPortalState();
  }

  _clearPortalState() {
    this._portalParent = null;
    this._portalNextSibling = null;
    this._isPortaled = false;
    this._isMovingPortal = false;
    this.removeAttribute('data-xtend-portal');
  }
}


if(!customElements.get('x-search-lightbox'))customElements.define('x-search-lightbox',XSearchLightbox);
