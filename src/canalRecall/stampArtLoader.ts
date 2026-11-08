// Loads the stamp art (the postcard compositor's square variant) on demand as
// its own bundle, `js/stamp-art.bundle.js` → `window.CanalRecallStampArt`, so
// the compositor's opentype.js never weighs on the overlay or ride bundles.
// Until it arrives — or if it never does — callers draw `drawPlainStamp`.

import type { StampArt } from './stampAlbumStamp.ts';

declare global {
  interface Window { CanalRecallStampArt?: StampArt }
}

export const STAMP_ART_BUNDLE = '/canal-drive/js/stamp-art.bundle.js';

let pending: Promise<StampArt | null> | null = null;

export function stampArtNow(): StampArt | null {
  return (typeof window !== 'undefined' && window.CanalRecallStampArt) || null;
}

/** Storybook and tests hand the module in directly. */
export function provideStampArt(art: StampArt): void {
  if (typeof window !== 'undefined') window.CanalRecallStampArt = art;
  pending = Promise.resolve(art);
}

export function loadStampArt(src = STAMP_ART_BUNDLE): Promise<StampArt | null> {
  const ready = stampArtNow();
  if (ready) return Promise.resolve(ready);
  if (pending) return pending;
  if (typeof document === 'undefined') return Promise.resolve(null);
  pending = new Promise<StampArt | null>(resolve => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const art = stampArtNow();
      if (!art) { resolve(null); return; }
      // Lettering without the outline font is still a stamp; with it, a better one.
      art.loadStampFont().then(() => resolve(art), () => resolve(art));
    };
    script.onerror = () => { pending = null; resolve(null); };
    document.head.appendChild(script);
  });
  return pending;
}
