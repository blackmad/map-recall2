// Read every bridge face the boat panoramas see (lane bridge-fidelity 2026-10-14).
//
//   npx tsx scripts/bridge-reference/run.ts --named          # the named canal-belt bridges (medium panoramas)
//   npx tsx scripts/bridge-reference/run.ts --all            # every numbered bridge in the elevation extract (small panoramas)
//   npx tsx scripts/bridge-reference/run.ts --ids=BRU0009,BRU0236
//
// Per bridge: artifacts/bridges/<id>/photo-<p|m>.jpg (the rectified face, 20 px/m named, 10 px/m bulk),
// read-<p|m>.jpg (the reading drawn on it), reading.json. Then artifacts/bridges/facts-staging.json:
// the automatic facts, accepted only where the two faces agree (count, shape, parapet) or the one face
// seen is clean (family). Review, then publish into scripts/data/amsterdam-bridge-facts.json
// (`--publish`), which scripts/own-ground/build-bridge-hints.ts reads under its hand overrides.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { bridgeFace, sources, topAt, type BridgeFace } from './geometry.ts';
import { bridgeViews, rectifyBridgeFace, type FaceCrop, type FaceView } from './select.ts';
import { annotate, readFace, type ArchShape, type Family, type FaceReading, type Parapet } from './classify.ts';
import { NAMED } from './named.ts';

export interface AutoFacts {
  id: string;
  arches?: number; shape?: ArchShape; family?: Family; parapet?: Parapet;
  /** Openings as fractions of the deck span [deck0, deck1], with the crown's drop under the deck edge (m). */
  openings?: [number, number, number][];
  source: string;
}

const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = 'artifacts/bridges';

async function one(id: string, detail: boolean): Promise<{ id: string; face: BridgeFace | null; reads: { view: FaceView; crop: FaceCrop; r: FaceReading }[]; error?: string }> {
  const face = bridgeFace(id);
  if (!face) return { id, face, reads: [], error: 'no face' };
  const views = await bridgeViews(face);
  const reads: { view: FaceView; crop: FaceCrop; r: FaceReading }[] = [];
  mkdirSync(`${OUT}/${id}`, { recursive: true });
  for (const view of views) {
    // Bulk: the 2000 px panorama (≈12 px/m at 25 m); named: the 4000 px one.
    const links = view.pick.record._links;
    view.pick.record = { ...view.pick.record, _links: detail ? { equirectangular_medium: links.equirectangular_medium } : { equirectangular_medium: links.equirectangular_small } };
    const crop = await rectifyBridgeFace(face, view, detail ? 20 : 10);
    if (!crop) continue;
    const r = readFace(face, crop), tag = view.side > 0 ? 'p' : 'm';
    writeFileSync(`${OUT}/${id}/photo-${tag}.jpg`, jpeg.encode({ data: Buffer.from(crop.data.buffer, crop.data.byteOffset, crop.data.byteLength), width: crop.width, height: crop.height }, 88).data);
    writeFileSync(`${OUT}/${id}/read-${tag}.jpg`, jpeg.encode({ data: Buffer.from(annotate(face, crop, r).buffer), width: crop.width, height: crop.height }, 85).data);
    reads.push({ view, crop, r });
  }
  writeFileSync(`${OUT}/${id}/reading.json`, JSON.stringify({
    id, name: face.name, deck: face.deck, crownNAP: face.crownNAP,
    views: reads.map(({ view, crop, r }) => ({ side: view.side, pano: view.pick.panoId, year: view.pick.missionYear, distM: +view.pick.distM.toFixed(1), obliquityDeg: +view.pick.obliquityDeg.toFixed(1), ppm: crop.ppm, cameraZ: crop.cameraZ, heightSource: crop.heightSource, flipped: crop.flipped, baseZ: crop.baseZ, topZ: crop.topZ, width: crop.width, height: crop.height, reading: { ...r, trace: undefined } })),
  }, null, 1));
  return { id, face, reads };
}

/** Facts the readings support. */
export function autoFacts(face: BridgeFace, reads: { view: FaceView; r: FaceReading }[]): AutoFacts | null {
  const ok = reads.filter(x => x.r.coverage > 0.7);
  if (!ok.length) return null;
  const f: AutoFacts = { id: face.id, source: `panorama ${ok.map(x => x.view.pick.panoId).join(',')}` };
  const span = face.deck[1] - face.deck[0];
  const inSpan = (r: FaceReading) => r.openings.filter(o => o.a1 > face.deck[0] && o.a0 < face.deck[1]);
  if (ok.length === 2) {
    const [a, b] = ok.map(x => inSpan(x.r));
    if (a.length === b.length && a.length >= 1 && a.length <= 9) {
      f.arches = a.length;
      f.openings = a.map((o, i) => {
        const p = b[i], a0 = (o.a0 + p.a0) / 2, a1 = (o.a1 + p.a1) / 2, mid = (a0 + a1) / 2;
        const drop = ((topAt(face, mid) + ok[0].r.dz - o.crownNAP) + (topAt(face, mid) + ok[1].r.dz - p.crownNAP)) / 2;
        return [+((a0 - face.deck[0]) / span).toFixed(3), +((a1 - face.deck[0]) / span).toFixed(3), +Math.max(0.3, drop).toFixed(2)];
      });
      if (ok[0].r.shape && ok[0].r.shape === ok[1].r.shape) f.shape = ok[0].r.shape;
    }
    if (ok[0].r.parapet === ok[1].r.parapet) f.parapet = ok[0].r.parapet;
    if (ok[0].r.family === ok[1].r.family) f.family = ok[0].r.family;
  } else f.family = ok[0].r.family;
  return f.arches || f.family || f.parapet ? f : null;
}

async function main(): Promise<void> {
  const { extract } = sources();
  const numbered = [...extract.measured, ...extract.fallback].map(b => b.id).filter(id => /^BRU\d+$/.test(id));
  const ids = flag('ids')?.split(',') ?? (process.argv.includes('--named') ? [...NAMED] : process.argv.includes('--all') ? numbered : []);
  const detailFor = (id: string) => NAMED.includes(id);
  const stagingFile = `${OUT}/facts-staging.json`;
  const staging: Record<string, AutoFacts> = existsSync(stagingFile) ? JSON.parse(readFileSync(stagingFile, 'utf8')).facts : {};
  let next = 0, done = 0, seen = 0, accepted = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let i = next++; i < ids.length; i = next++) {
      try {
        const res = await one(ids[i], detailFor(ids[i]));
        if (res.reads.length) seen++;
        const f = res.face && autoFacts(res.face, res.reads);
        if (f) { staging[ids[i]] = f; accepted++; } else delete staging[ids[i]];
      } catch (e) { console.log(ids[i], 'error', String(e).slice(0, 200)); }
      if (++done % 25 === 0) console.log(`${done}/${ids.length} seen ${seen} facts ${accepted}`);
    }
  }));
  const facts = Object.fromEntries(Object.entries(staging).sort(([a], [b]) => a.localeCompare(b)));
  const tally = (k: keyof AutoFacts) => Object.values(facts).filter(f => f[k] !== undefined).length;
  const summary = { bridges: Object.keys(facts).length, arches: tally('arches'), shape: tally('shape'), family: tally('family'), parapet: tally('parapet') };
  writeFileSync(stagingFile, JSON.stringify({ generated: 'scripts/bridge-reference/run.ts', panoramas: 'Gemeente Amsterdam panoramas (boat missions 2017/2021), CC BY 4.0', summary, facts }, null, 1));
  console.log(JSON.stringify({ run: { ids: ids.length, seen, accepted }, staging: summary }));
  if (process.argv.includes('--publish')) {
    writeFileSync('scripts/data/amsterdam-bridge-facts.json', JSON.stringify({ source: 'scripts/bridge-reference/run.ts (Gemeente Amsterdam panoramas, CC BY 4.0; boat missions)', summary, facts }, null, 1) + '\n');
    console.log('published scripts/data/amsterdam-bridge-facts.json');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
