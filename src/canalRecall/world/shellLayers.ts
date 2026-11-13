/**
 * The facade atlas layer table a baked SHEL shell's `layers` bytes index (lane R4-A, #243). A shell is the runtime
 * coarse chunk frozen at compile time; its layer bytes are only right while the photo look's array has the same layers
 * in the same order (the bay cells of bayLook.ts BAY_ENTRIES, the masonry cell, then the roof cells). The compiler
 * records `shellLayerHash()` in tiles.json `shells.layers`; the runtime compares it with its own and draws no shell
 * from a stale table (the coarse shells are built at runtime instead, as before).
 */
import { BAY_ENTRIES, BAY_LAYER_COUNT, FATIH_MASONRY_LAYER } from '../bayLook.js';
import { ROOF_LAYER_COUNT } from '../look/paintLookAtlas.js';

/** The layer table as text: one line per bay layer (archetype, style, kind, shop and masonry flags), then the roof cells. */
export function shellLayerTable(): string {
  const bays = BAY_ENTRIES.map(e => `${e.layer}:${e.archetype}|${e.style}|${e.kind}|${e.restrainedShop ? 1 : 0}|${e.originalMasonry ? 1 : 0}${e.smooth ? '|smooth' : ''}`);
  return [...bays, `bays=${BAY_LAYER_COUNT}`, `masonry=${FATIH_MASONRY_LAYER}`, `roof=${ROOF_LAYER_COUNT}`].join('\n');
}

/** FNV-1a 32 of a string, 8 hex digits. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

let memo: string | null = null;
/** The hash of `shellLayerTable()` (tiles.json `shells.layers`). */
export function shellLayerHash(): string { return memo ??= fnv1a(shellLayerTable()); }
