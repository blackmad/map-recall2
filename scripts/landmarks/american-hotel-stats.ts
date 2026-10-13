/**
 * Triangle count of the American Hotel builder per section (b.mark names) and per material, before export
 * (the export drops a few buried / straddling openings, so the GLB comes out slightly lower).
 *
 *   node --import tsx scripts/landmarks/american-hotel-stats.ts
 */
import type * as T from 'three';
import {buildAmericanHotel} from './american-hotel-builder.ts';

const bySection = new Map<string, number>(), byColour = new Map<string, number>();
let section = 'shell-pre';
const tris = (g: T.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
buildAmericanHotel(0, 0, {
  add: (g: T.BufferGeometry, c: string) => {
    const n = tris(g);
    bySection.set(section, (bySection.get(section) ?? 0) + n);
    byColour.set(c, (byColour.get(c) ?? 0) + n);
  },
  mark: (n: string) => { section = n; },
} as never);
let total = 0;
for (const [k, v] of bySection) { total += v; console.log(`${k.padEnd(14)} ${Math.round(v)}`); }
console.log(`${'total'.padEnd(14)} ${Math.round(total)}`);
console.log([...byColour].sort((a, b) => b[1] - a[1]).map(([c, v]) => `${c} ${Math.round(v)}`).join(', '));
