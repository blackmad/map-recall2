/**
 * Re-derive each measured reading's drawn `paint` (retailPuiPaint.ts drawnPaint) in data/retail-ground/pui-paint.json
 * after the drawing rule changes; the readings and receipts are kept. No downloads.
 *   node --import tsx scripts/retail-ground/repaint-pui.ts
 */
import fs from 'node:fs';
import { drawnPaint } from '../../src/canalRecall/retailPuiPaint.ts';

const FILE = 'data/retail-ground/pui-paint.json';
const pui = JSON.parse(fs.readFileSync(FILE, 'utf8')) as { buildings: Record<string, { paint: string; hex: string; cls: 'pale' | 'colour' | 'dark' }> };
let changed = 0;
for (const v of Object.values(pui.buildings)) { const p = drawnPaint(v.cls, v.hex); if (p !== v.paint) { v.paint = p; changed++; } }
fs.writeFileSync(FILE, JSON.stringify(pui, null, 1));
console.log(`repainted ${changed} of ${Object.keys(pui.buildings).length} -> ${FILE}`);
