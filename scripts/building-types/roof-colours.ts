/**
 * Roof colour per building-type design: the PDOK orthophoto reading of the design's placed pands (roof-facts sidecar,
 * Beeldmateriaal Nederland CC BY 4.0), what the game draws for the design's authored roof tint, and the agreement of a
 * sunlit street-photo sample with the orthophoto (roofColour.ts `checkRoofColour`). Issue #75.
 *
 *   node --import tsx scripts/building-types/roof-colours.ts [--types=oo-ta,nd-ck] [--photo=oo-ta-side:#7d5249,...] [--instances=<file>]
 *
 * --instances defaults to public/canal-drive/building-types/instances.json; a staging area's instances.json (stage-buurt
 * output: {instances: [{pandId, type, centreLngLat}]}) works too. Prints one line per design/variant.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {cityTint, hexToRgb, rgbToHsl, type MaterialSlot} from '../../src/canalRecall/look/palette.ts';
import {decodeRoofFactTile, type RoofFact} from '../../src/canalRecall/roofs/roofSlots.ts';
import {checkRoofColour, orthoRoofSummary} from '../../src/canalRecall/buildingTypes/roofColour.ts';
import type {TypeSpec} from '../../src/canalRecall/buildingTypes/spec.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const want = arg('types').split(',').filter(Boolean);
const photo = new Map(arg('photo').split(',').filter(Boolean).map(p => p.split(':') as [string, string]));
const raw = JSON.parse(fs.readFileSync(arg('instances', 'public/canal-drive/building-types/instances.json'), 'utf8'));
const rows: {pand: string; type: string; variant: string; lngLat: [number, number]}[] = Array.isArray(raw)
  ? raw.map((r: any) => ({pand: r.pand, type: r.unit.split('__')[0], variant: r.variant, lngLat: r.anchor}))
  : raw.instances.map((r: any) => ({pand: r.pandId, type: r.type, variant: r.variant ?? '-', lngLat: r.centreLngLat}));
const tiles = new Map<string, Map<string, RoofFact>>();
function fact(pand: string, [lng, lat]: [number, number]): RoofFact | null {
  const x = Math.floor((lng + 180) / 360 * 2 ** 14), y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** 14);
  // a pand near a tile edge is filed under the tile of its own centroid; look in the neighbours too
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = `${x + dx}/${y + dy}`;
    if (!tiles.has(k)) { const f = `public/data/extracts/amsterdam/roof-facts/14/${k}.json.gz`; tiles.set(k, fs.existsSync(f) ? decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString())) : new Map()); }
    const hit = tiles.get(k)!.get(pand);
    if (hit) return hit;
  }
  return null;
}
const groups = new Map<string, typeof rows>();
for (const r of rows) if (!want.length || want.some(w => r.type.startsWith(w))) (groups.get(r.type) ?? groups.set(r.type, []).get(r.type)!).push(r);
const hsl = (hex: string) => rgbToHsl(hexToRgb(hex)).map((v, i) => i ? v.toFixed(2) : Math.round(v)).join('/');
for (const [type, list] of [...groups].sort()) {
  const specFile = `src/canalRecall/buildingTypes/types/${type}.json`, spec = fs.existsSync(specFile) ? JSON.parse(fs.readFileSync(specFile, 'utf8')) as TypeSpec : null;
  const s = orthoRoofSummary(list.map(r => fact(r.pand, r.lngLat)));
  const roofs = spec ? [...new Set(Object.values(spec.variants).map(v => JSON.stringify(v.palette.roof)))].map(j => JSON.parse(j)) : [];
  const drawn = roofs.map(r => `${r.slot} ${r.tint}${r.measured ? ' (measured)' : ''} -> ${cityTint(r.slot as MaterialSlot, r.tint, r.measured ? 'measured' : undefined)} [hsl ${hsl(cityTint(r.slot as MaterialSlot, r.tint, r.measured ? 'measured' : undefined))}]`).join('; ');
  console.log(`${type} (${spec?.roof.form ?? 'no spec yet'}) n=${list.length} facts=${s.read} pitched=${s.used} ${JSON.stringify(s.slots)} ortho ${s.hex ?? '-'}${s.hex ? ` [hsl ${hsl(s.hex)}]` : ''}\n   drawn: ${drawn}`);
  const p = photo.get(type);
  if (p && s.hex) { const c = checkRoofColour(p, s.hex); console.log(`   photo ${p} [hsl ${hsl(p)}] vs ortho: ${c.reason} (hue ${c.hueDiffDeg ?? 'n/a'}, dL ${c.lightnessDiff}, dS ${c.saturationDiff})`); }
}
