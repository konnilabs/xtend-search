// XLightbox-derived viewport shell. RMT projects all changing content into slots.
export const LIGHTBOX_STYLES=`
:host{font-family:inherit;color:var(--ink,#f2eee7)}
.overlay{box-sizing:border-box;position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;border:0;border-radius:0;padding:clamp(12px,2vw,28px);background:var(--lightbox-bg,var(--surface,#111));color:inherit;overflow:hidden;grid-template-rows:minmax(0,1fr) auto;gap:16px}
.overlay[open]{display:grid}.overlay::backdrop{background:#000}
.content{position:relative;min-width:0;min-height:0;overflow:hidden;margin-top:36px}
slot[name=media]{display:block;position:absolute;inset:0}
slot[name=controls]{display:block;max-height:42dvh;overflow:auto}
slot[name=close]{display:block;position:absolute;right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));z-index:2}
::slotted(.lightbox-media){position:absolute;inset:0;display:block;width:100%;height:100%;min-height:0;object-fit:contain;user-select:none;touch-action:pan-y}
@media(prefers-reduced-motion:no-preference){.overlay[open]{animation:appear 140ms ease-out}@keyframes appear{from{opacity:0}to{opacity:1}}}
@media(forced-colors:active){.overlay{background:Canvas;color:CanvasText}}
`;
