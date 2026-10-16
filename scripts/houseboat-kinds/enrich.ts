// Per-boat facts read off the PDOK 8 cm orthophoto, written into the houseboat extract:
//   form        'ark' | 'barge' | 'hullbox', for every boat a person labelled on the photo
//   stale       true where the outline holds open water or a small open boat (not drawn)
//   cabinShare  roofed share of the length (hullbox cabin; barge cabins + wheelhouse)
//   roofHex     the drawn colour of the measured roof class (roofClass.ts)
// Labels: labels.json (sample + ring sets, take precedence) and city-labels.json (the
// blind city pass). Boats nobody labelled keep the footprint classifier; a ship hull
// nobody could see (trees, shadow) keeps the hash split between barge and hullbox.
//   npx tsx scripts/houseboat-kinds/enrich.ts            -> tmp/houseboats/houseboats.json + report
//   npx tsx scripts/houseboat-kinds/enrich.ts --publish  -> also public/data/extracts/amsterdam/houseboats.json
//   npx tsx scripts/houseboat-kinds/enrich.ts --check    -> fail if the published labels drifted
import fs from 'node:fs';
import { classifyHouseboatHull, houseboatFrame, houseboatKind, type Houseboat, type HouseboatKind } from '../../src/canalRecall/houseboats.ts';
import type { PixelStats } from './pixels.ts';
import { ROOF_CLASS_HEX, roofClass } from './roofClass.ts';

const PUBLISHED = 'public/data/extracts/amsterdam/houseboats.json', STAGING = 'tmp/houseboats/houseboats.json';
const PIXELS = 'artifacts/houseboat-kinds/pixels.json';
type Extract = { version: number; source: string; attribution: string; bbox: string; fetched: string; photo?: string; boats: Houseboat[] };
const extract: Extract = JSON.parse(fs.readFileSync(PUBLISHED, 'utf8'));
const { boats: sample }: { boats: Record<string, { label: string; note?: string }> } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/labels.json', 'utf8'));
const { boats: city }: { boats: Record<string, string> } = JSON.parse(fs.readFileSync('scripts/houseboat-kinds/city-labels.json', 'utf8'));

type Fact = { form?: HouseboatKind; stale?: true; cabinShare?: number };
/** What the labels say about one boat, or null when nobody saw it. */
export function labelledFact(id: string): Fact | null {
  const s = sample[id];
  if (s) {
    if (s.label !== 'none') return { form: s.label as HouseboatKind };
    // A `none` in the sample set is stale only when the note says the berth is empty or holds a small boat.
    return /berth empty|small|tiny/.test(s.note ?? '') && !/offset/.test(s.note ?? '') ? { stale: true } : null;
  }
  const c = city[id];
  if (!c || c === 'u') return null;
  if (c === 'e' || c === 's') return { stale: true };
  if (c === 'a') return { form: 'ark' };
  return { form: c[0] === 'b' ? 'barge' : 'hullbox', cabinShare: Number(c[1]) / 10 };
}

const strip = ({ form, stale, cabinShare, roofHex, ...rest }: Houseboat) => rest;
if (process.argv.includes('--check')) {
  // Labels and published facts agree (colours come from the photo cache and are not rechecked).
  const wrong = extract.boats.filter(b => { const f = labelledFact(b.id) ?? {}; return b.form !== f.form || b.stale !== f.stale || b.cabinShare !== f.cabinShare; });
  if (wrong.length) { console.error(`${PUBLISHED}: ${wrong.length} boats disagree with the labels (first ${wrong[0].id}); run scripts/houseboat-kinds/enrich.ts --publish`); process.exit(1); }
  console.log(`${PUBLISHED}: photo facts in sync with labels (${extract.boats.filter(b => b.form || b.stale).length} boats)`);
  process.exit(0);
}

const pixels: Record<string, PixelStats> = JSON.parse(fs.readFileSync(PIXELS, 'utf8'));
const before = new Map(extract.boats.map(b => [b.id, b]));
const out: Houseboat[] = [];
const tally: Record<string, number> = {};
const bump = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };
for (const boat of extract.boats) {
  const base = strip(boat), fact = labelledFact(boat.id), px = pixels[boat.id];
  const next: Houseboat = { ...base, ...(fact ?? {}) };
  // No colour where the labeller saw trees or shadow over the outline instead of a roof.
  const unseen = city[boat.id] === 'u' || (sample[boat.id]?.label === 'none' && !fact);
  if (!fact?.stale && !unseen && px) next.roofHex = ROOF_CLASS_HEX[roofClass(px.core ?? px.inner)];
  out.push(next);
  const f = houseboatFrame(boat);
  const hull = f ? classifyHouseboatHull(f.local, f.length, f.width) : 'ark';
  bump(fact?.stale ? 'stale' : fact?.form ? `photo:${fact.form}` : hull === 'ark' ? 'footprint:ark' : 'hash:ship');
}
const text = JSON.stringify({ ...extract, photo: 'form, stale, cabinShare and roofHex read off the PDOK 8 cm orthophoto (Actueel_orthoHR, CC BY 4.0), 2026-10-16; scripts/houseboat-kinds/enrich.ts' , boats: out });
fs.mkdirSync('tmp/houseboats', { recursive: true });
fs.writeFileSync(STAGING, text);

// Report: coverage, what changes in the drawn kind, size.
const drawn = (b: Houseboat) => { const f = houseboatFrame(b); return !f ? 'none' : b.stale ? 'hidden' : b.form ?? houseboatKind(b.id, f.local, f.length, f.width); };
const changes: Record<string, number> = {};
for (const b of out) { const was = drawn(before.get(b.id)!), now = drawn(b); if (was !== now) changes[`${was}->${now}`] = (changes[`${was}->${now}`] ?? 0) + 1; }
const kinds = out.reduce((m, b) => { const k = drawn(b); m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
const labelled = (tally['photo:ark'] ?? 0) + (tally['photo:barge'] ?? 0) + (tally['photo:hullbox'] ?? 0) + (tally.stale ?? 0);
console.log('sources', tally);
console.log(`photo-labelled ${labelled}/${out.length} (${(100 * labelled / out.length).toFixed(1)} %), hash fallback ${tally['hash:ship'] ?? 0}, roofHex ${out.filter(b => b.roofHex).length}`);
console.log('drawn', kinds, 'changes', changes);
console.log(`${(Buffer.byteLength(text) / 1024).toFixed(0)} KB (was ${(fs.statSync(PUBLISHED).size / 1024).toFixed(0)} KB) -> ${STAGING}`);
if (process.argv.includes('--publish')) { fs.writeFileSync(PUBLISHED, text); console.log(`published -> ${PUBLISHED}`); }
