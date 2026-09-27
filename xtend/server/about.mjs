import {aboutContent,escapeHtml} from '../shared/about.mjs';
import {VERSION} from './control/release.mjs';
export function aboutPage(locale='de'){
 const {title,html}=aboutContent(locale,VERSION),back=locale==='en'?'Back to search':'Zur Suche';
 return `<!doctype html><html lang="${locale==='en'?'en':'de'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><link rel="icon" href="/assets/xtend/favicon.png" type="image/png" sizes="64x64"><link rel="icon" sizes="any" href="/assets/xtend/mark.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/xtend/standalone/search.css"></head><body class="about-page"><header class="about-page-header"><a class="wordmark" href="/"><img src="/assets/xtend/mark.svg" width="32" height="32" alt=""><span>XTend<span class="wordmark-suffix">.search</span></span></a><a class="about-back" href="/">${back} <span aria-hidden="true">↗</span></a></header><main class="about-page-main"><h1>${escapeHtml(title)}</h1>${html}</main></body></html>`;
}
