export const LIGHTBOX_STYLES=`
        :host {
          --xlightbox-overlay-bg: var(--lightbox-bg, var(--xtend-overlay-bg, rgba(0, 0, 0, 0.82)));
          --xlightbox-blur: var(--lightbox-blur, var(--xtend-glass-blur, 18px));
          --xlightbox-padding: var(--lightbox-padding, clamp(0.75rem, 2vw, 2rem));
          --xlightbox-radius: var(--lightbox-radius, var(--xtend-radius, 0.75rem));
          --xlightbox-shadow: var(--lightbox-shadow, 0 28px 84px rgba(0, 0, 0, 0.45));
          --xlightbox-close-bg: var(--lightbox-close-bg, rgba(255, 255, 255, 0.12));
          --xlightbox-close-color: var(--lightbox-close-color, #ffffff);
          --xlightbox-close-hover-bg: var(--lightbox-close-hover-bg, rgba(255, 255, 255, 0.2));
          --xlightbox-close-hover-color: var(--lightbox-close-hover-color, #ffffff);
          --xlightbox-focus-outline: var(--lightbox-focus-outline, var(--xtend-focus-outline, 2px solid #4fc3f7));
          display: inline-block;
          font-family: var(--xtend-font-family, 'Inter', 'Segoe UI', Arial, sans-serif);
        }
        .trigger {
          display: inline-flex;
        }
        .overlay {
          position: fixed;
          inset: 0;
          z-index: var(--surface-overlay-z, 2147483646);
          display: none;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          width: 100vw;
          min-height: 100vh;
          min-height: 100dvh;
          padding: var(--xlightbox-padding);
          overflow: hidden;
          background: var(--xlightbox-overlay-bg);
          backdrop-filter: blur(var(--xlightbox-blur));
          animation: fadeInOverlay 0.18s ease-out;
        }
        :host([open]) .overlay {
          display: flex;
        }
        .overlay[hidden] {
          display: none !important;
        }
        .content {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          max-width: 100%;
          max-height: 100%;
          border-radius: var(--xlightbox-radius);
          box-shadow: var(--xlightbox-shadow);
          animation: fadeContentIn 0.18s ease-out;
        }
        .content img {
          display: block;
          width: auto;
          height: auto;
          max-width: calc(100vw - var(--xlightbox-padding) - var(--xlightbox-padding));
          max-height: calc(100vh - var(--xlightbox-padding) - var(--xlightbox-padding));
          max-height: calc(100dvh - var(--xlightbox-padding) - var(--xlightbox-padding));
          object-fit: contain;
          border-radius: var(--xlightbox-radius);
          background: #050506;
        }
        .content.closing {
          animation: fadeContentOut 0.16s ease-in forwards;
        }
        .close-btn {
          position: absolute;
          top: clamp(0.6rem, 1.2vw, 1rem);
          right: clamp(0.6rem, 1.2vw, 1rem);
          z-index: 2;
          width: 2.5rem;
          height: 2.5rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          background: var(--xlightbox-close-bg);
          color: var(--xlightbox-close-color);
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
          transition: background 0.16s ease, color 0.16s ease, transform 0.16s ease;
        }
        .close-btn:hover {
          background: var(--xlightbox-close-hover-bg);
          color: var(--xlightbox-close-hover-color);
          transform: translateY(-1px);
        }
        .close-btn:focus-visible {
          outline: var(--xlightbox-focus-outline);
          outline-offset: 2px;
        }
        .close-btn svg {
          width: 1.1rem;
          height: 1.1rem;
          stroke: currentColor;
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeContentIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeContentOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.98); }
        }
        @media (prefers-reduced-motion: reduce) {
          .overlay,
          .content,
          .close-btn {
            animation: none !important;
            transition: none !important;
          }
        }
        @media (forced-colors: active) {
          .overlay,
          .content,
          .close-btn {
            forced-color-adjust: auto;
          }
          .overlay {
            background: Canvas;
          }
          .content {
            border: 1px solid CanvasText;
            box-shadow: none;
          }
          .close-btn {
            color: ButtonText;
            background: ButtonFace;
            border: 1px solid ButtonText;
            box-shadow: none;
          }
          .close-btn:focus-visible {
            outline-color: Highlight;
          }
        }
      `;
