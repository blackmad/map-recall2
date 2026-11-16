/**
 * Photo walls (buurt generators round 14): the photo reader's assembled reads (scripts/centrum-looks/photo-reads.ts
 * `assemble`, over scripts/buurt-generators/row-cuts.ts cuts) into the district's measured file as `photoWalls`, one per
 * generator row (the cut's pand's series row), the most confident of several reads of one pand (a retry from another
 * capture date). generate.ts wallHexOf uses a read at PHOTO_WALL_MIN, over the pixel samples.
 *
 * Round 15: the reads are the reader v2's (`assemble2`, colour against the swatch card plus the crown), carrying the crown,
 * cornice and crown confidence `cc` into the record (generate.ts photoGableOf).
 *
 *   node --import tsx scripts/buurt-generators/photo-walls.ts --district=de-pijp <photo-reads.json...>
 */
import fs from 'node:fs';

const district = process.argv.find(a => a.startsWith('--district='))?.slice(11) ?? 'de-pijp';
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
type Read = { finish: string; family: string; confidence: number; crown?: string; cornice?: string; cc?: number };
const best = new Map<string, Read>(), crown = new Map<string, Read>();
for (const f of files) for (const [pid, r] of Object.entries<Read>(JSON.parse(fs.readFileSync(f, 'utf8')).reads ?? {})) {
  if (!best.has(pid) || r.confidence > best.get(pid)!.confidence) best.set(pid, r);
  // Round 16: the crown is the most confident crown read of the pand (a second capture can see a gable the first's trees hid).
  if (r.crown && r.crown !== 'not-visible' && (!crown.has(pid) || (r.cc ?? 0) > (crown.get(pid)!.cc ?? 0))) crown.set(pid, r);
}
for (const [pid, c] of crown) best.set(pid, { ...best.get(pid)!, crown: c.crown, cornice: c.cornice, cc: c.cc });
const recs = new Map((JSON.parse(fs.readFileSync(`artifacts/buurt-generators/${district}/row-front.json`, 'utf8')).records as any[]).map(r => [r.pandId, r]));
const out: Record<string, Read & { pandId: string }> = {};
let unplaced = 0;
// Round 17: the row's wall is its members' brick consensus, not its single most confident read: a painted house's read
// (the house's own, round 15) left the row to the street's family (Saenredamstraat 153342, round 16 blind: "all red"
// where its members read brown and dark grey). The family most confident members read (>= 0.7) wins, then the summed
// confidence; with no confident brick read, the most confident read as before.
const byRow = new Map<string, Array<Read & { pandId: string }>>();
for (const [pid, r] of best) {
  const row = recs.get(pid)?.series?.id?.split(':')[0];
  if (!row) { unplaced++; continue; }
  byRow.set(row, [...(byRow.get(row) ?? []), { ...r, pandId: pid }]);
}
const pick = (r: Read & { pandId: string }) => ({ finish: r.finish, family: r.family, confidence: r.confidence, pandId: r.pandId, ...(r.crown ? { crown: r.crown, cornice: r.cornice, cc: r.cc } : {}) });
for (const [row, reads] of byRow) {
  const brick = reads.filter(r => r.finish === 'brick' && r.family !== 'unclear' && r.confidence >= 0.7);
  const fam = new Map<string, { n: number; sum: number; top: Read & { pandId: string } }>();
  for (const r of brick) {
    const f = fam.get(r.family) ?? { n: 0, sum: 0, top: r };
    f.n++; f.sum += r.confidence; if (r.confidence > f.top.confidence || (r.confidence === f.top.confidence && r.pandId < f.top.pandId)) f.top = r;
    fam.set(r.family, f);
  }
  const win = [...fam.entries()].sort((a, b) => b[1].n - a[1].n || b[1].sum - a[1].sum || (a[0] < b[0] ? -1 : 1))[0];
  const top = win ? win[1].top : [...reads].sort((a, b) => b.confidence - a.confidence || (a.pandId < b.pandId ? -1 : 1))[0];
  out[row] = pick(top);
}
const file = `src/canalRecall/buurtGenerator/districts/measured/${district}.json`, m = JSON.parse(fs.readFileSync(file, 'utf8'));
m.photoReads = Object.fromEntries([...best].filter(([pid]) => recs.has(pid)).sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([pid, r]) => [pid, { finish: r.finish, family: r.family, confidence: r.confidence, ...(r.crown ? { crown: r.crown, cornice: r.cornice, cc: r.cc } : {}) }]));
m.photoWalls = Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
m.photoWallSource = 'opus colour-family and crown reads (scripts/centrum-looks/photo-reader-prompt-v2.md over v1, photo-reads.ts assemble2) of one rectified panorama cut per row (scripts/buurt-generators/row-cuts.ts; data.amsterdam.nl panoramas, CC BY 4.0)';
fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
const conf = Object.values(out).filter(r => r.confidence >= 0.7), tally: Record<string, number> = {};
for (const r of conf) tally[r.family] = (tally[r.family] ?? 0) + 1;
console.log(`${district}: ${Object.keys(out).length} rows read, ${conf.length} at >= 0.7, ${unplaced} reads off the staged rows`, JSON.stringify(tally));
