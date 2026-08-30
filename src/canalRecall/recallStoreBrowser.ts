/**
 * Browser entry for the recall store.
 *
 * `recallStore.ts` already loads Firebase through dynamic `import()`, so the
 * sign-in and sync code was always meant to arrive only when someone signs in.
 * Bundling it to a self-contained IIFE defeated that: esbuild has nowhere to put
 * a lazy chunk in that format, so it inlined all of Firebase and every guest
 * downloaded 750 KB of Firestore they would never call.
 *
 * Built as ESM with code splitting instead, the dynamic imports become real
 * chunks. This entry publishes the same global the page has always read, so
 * nothing downstream changes. Module scripts are deferred, which is safe here:
 * `new Game()` runs on `window.load`, after deferred modules have executed.
 */
import { store, RECALL_LOCAL_RADIUS_METERS, RECALL_CHUNK_METERS } from './recallStore';

declare global {
  interface Window { CanalRecallStoreModule?: unknown }
}

window.CanalRecallStoreModule = { store, RECALL_LOCAL_RADIUS_METERS, RECALL_CHUNK_METERS };

export { store, RECALL_LOCAL_RADIUS_METERS, RECALL_CHUNK_METERS };
