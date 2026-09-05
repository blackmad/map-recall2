import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { defaultPreferences, type ZoomClamp } from '../game/preferences.ts';
import { OverlayApp, type OverlayCallbacks } from './OverlayApp.tsx';
import { createOverlayStore, type OverlayStore } from './store.ts';

const FALLBACK_ZOOM: ZoomClamp = { min: 0.2, max: 1.5, defaultZoom: 0.5 };

export interface CanalOverlayHandle {
  store: OverlayStore;
  callbacks: OverlayCallbacks;
}

let installed: CanalOverlayHandle | null = null;
let root: Root | null = null;

function noop(): void {}

export function install(container: HTMLElement | null): CanalOverlayHandle {
  if (installed) return installed;
  if (!container) throw new Error('canal-overlay-root is missing');
  const callbacks: OverlayCallbacks = {
    zoom: FALLBACK_ZOOM,
    onStart: noop,
    onLiveChange: noop,
    onAccountClick: noop,
    onClearKnowledge: noop,
    onClearAllData: noop,
    onSkipMastered: noop,
    onCloseSettings: noop,
  };
  const store = createOverlayStore(defaultPreferences(FALLBACK_ZOOM));
  root = createRoot(container);
  flushSync(() => {
    root!.render(<OverlayApp store={store} callbacks={callbacks} />);
  });
  installed = { store, callbacks };
  return installed;
}

export function getOverlay(): CanalOverlayHandle | null {
  return installed;
}
