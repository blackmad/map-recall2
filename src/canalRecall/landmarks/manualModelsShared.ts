/**
 * The manual-model catalogue, read from the one copy the ride already loaded.
 *
 * `manualModels.ts` inlines manualCatalogue.json (~1.2 MB) and the hospital
 * footprints. Bundled the ordinary way, the ride shipped six copies of it
 * (signature-placement, three-buildings, route-selection and the three game
 * runtimes), ~1 MB of brotli and ~6 MB of JavaScript to parse before the setup
 * panel (docs/preview/first-load-2026-10-17.md). `scripts/esbuild-ride-bundle.mjs`
 * swaps `./manualModels` for this module in every ride bundle but
 * signature-placement.bundle.js, which index.html loads first and which exports
 * the catalogue on `CanalRecallSignatureLandmarks` (landmarks/browser.ts).
 *
 * Node tests and every other page keep importing manualModels.ts directly.
 */
import type { SignatureModelSpec } from './signaturePlacement';

interface SharedCatalogue {
  ALL_MANUAL_LANDMARKS?: readonly SignatureModelSpec[];
  MANUAL_LANDMARKS?: readonly SignatureModelSpec[];
  MANUAL_ORDINARY_BUILDINGS?: readonly SignatureModelSpec[];
}

const shared = (globalThis as { CanalRecallSignatureLandmarks?: SharedCatalogue }).CanalRecallSignatureLandmarks;
if (!shared?.MANUAL_LANDMARKS || !shared.MANUAL_ORDINARY_BUILDINGS || !shared.ALL_MANUAL_LANDMARKS) {
  // Loud on purpose: a silently empty catalogue would drop every hand-built landmark from the ride.
  throw new Error('signature-placement.bundle.js must load before this bundle: it carries the manual-model catalogue.');
}

export const ALL_MANUAL_LANDMARKS: readonly SignatureModelSpec[] = shared.ALL_MANUAL_LANDMARKS;
export const MANUAL_LANDMARKS: readonly SignatureModelSpec[] = shared.MANUAL_LANDMARKS;
export const MANUAL_ORDINARY_BUILDINGS: readonly SignatureModelSpec[] = shared.MANUAL_ORDINARY_BUILDINGS;
